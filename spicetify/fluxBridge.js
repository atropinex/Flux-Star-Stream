// Flux-Star-Stream bridge: a Spicetify extension.
//
// It runs inside the Spotify desktop app and connects to the Flux-Star-Stream overlay (a small server on this
// computer). The overlay asks, this extension does it with Spotify's own player and Spotify's own login.
// That is why no Client ID, no login and no Spotify Web API limits are involved.
//
// Install:  copy this file into Spicetify's Extensions folder, then run
//             spicetify config extensions fluxBridge.js
//             spicetify apply

(function FluxBridge() {
  'use strict';

  const PORT = 52701; // must match BRIDGE_PORT in src/main/models/BridgeModel.ts
  const ADDRESS = `ws://127.0.0.1:${PORT}`;
  const RETRY_MS = 3000;
  const PLAY_CHECK_MS = 1000;
  const BRIDGE_BUILD = 'search-results-v6';

  // Spicetify loads extensions before Spotify is ready, so wait for it.
  if (!window.Spicetify || !Spicetify.Player || !Spicetify.Platform || !Spicetify.CosmosAsync) {
    setTimeout(FluxBridge, 300);
    return;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const player = () => Spicetify.Player;

  // Account settings that describe the plan. Everything else in Spotify's product state is ignored.
  const PLAN_KEY = /product|plan|tier|catalogue|^type$|^name$|financial|family|duo|student|subscription|offer/i;

  // ---------- smooth transition between songs ----------
  //
  // Spotify's real crossfade is part of its audio engine and cannot be switched on from here. Skipping to the next
  // song early does NOT crossfade: the song is simply cut off. So the transition is made with the volume instead.
  // The end of a song fades out and the start of the next one fades in, and nothing is ever skipped.
  // That is a dip, not an overlap. For a true overlap use Spotify's own Crossfade (Settings > Playback) and turn
  // this off, because using both would fade twice.
  const TRANSITION_STEP_MS = 50;
  const CROSSFADE_KEY = 'fluxBridge.crossfade';
  const VOLUME_BACKUP_KEY = 'fluxBridge.volumeBackup';

  const storage = {
    read(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    write(key, value) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (error) {
        /* not saved */
      }
    }
  };

  let crossfadeConfig = { enabled: false, seconds: 6 };
  try {
    // Remembered, so it still works after Spotify restarts, before the overlay has sent it again.
    const saved = JSON.parse(storage.read(CROSSFADE_KEY) || 'null');
    if (saved) crossfadeConfig = { enabled: Boolean(saved.enabled), seconds: Math.max(0, Math.min(12, Number(saved.seconds) || 0)) };
  } catch (error) {
    /* keep the defaults */
  }

  let baseVolume = null; // the volume the user chose. null while no fade is going on

  /** Puts the volume back to what the user chose. */
  function restoreVolume() {
    if (baseVolume === null) return;
    player().setVolume(baseVolume);
    baseVolume = null;
    storage.write(VOLUME_BACKUP_KEY, null);
  }

  /** From 0 (silent) to 1 (full): how loud the song should be here, going by its position. */
  function transitionGain(progressMs, durationMs) {
    // Each side takes half of the chosen time, so the whole transition lasts as long as the setting says.
    const half = Math.min(crossfadeConfig.seconds * 500, durationMs / 3);
    if (half <= 0) return 1;

    const remaining = durationMs - progressMs;
    let gain = 1;
    if (progressMs < half) gain = Math.min(gain, Math.sin((progressMs / half) * (Math.PI / 2))); // fading in
    if (remaining < half) gain = Math.min(gain, Math.cos((1 - remaining / half) * (Math.PI / 2))); // fading out
    return Math.max(0, gain);
  }

  function applyTransition() {
    try {
      const data = player().data;
      const item = data && (data.item || data.track);
      const duration = player().getDuration() || (item && ((item.duration && item.duration.milliseconds) || item.duration_ms)) || 0;

      const isActive =
        crossfadeConfig.enabled && crossfadeConfig.seconds > 0 && item && duration > 0 &&
        player().isPlaying() &&
        player().getRepeat() !== 2; // a single song on repeat should loop cleanly

      if (!isActive) return restoreVolume();

      const gain = transitionGain(player().getProgress() || 0, duration);
      if (gain >= 0.999) return restoreVolume();

      if (baseVolume === null) {
        baseVolume = player().getVolume();
        storage.write(VOLUME_BACKUP_KEY, String(baseVolume)); // so a crash in the middle cannot leave the volume low
      }
      player().setVolume(baseVolume * gain);
    } catch (error) {
      /* the player is not ready yet */
    }
  }

  setInterval(applyTransition, TRANSITION_STEP_MS);
  Spicetify.Player.addEventListener('songchange', applyTransition); // lower the volume the moment a song starts

  // If Spotify was closed in the middle of a fade, the saved volume is put back.
  setTimeout(() => {
    const backup = Number(storage.read(VOLUME_BACKUP_KEY));
    if (backup > 0 && baseVolume === null) {
      try {
        player().setVolume(backup);
      } catch (error) {
        /* ignore */
      }
    }
    storage.write(VOLUME_BACKUP_KEY, null);
  }, 2000);

  // ---------- what is playing ----------

  // Spotify-internal image URIs are not valid browser image URLs.
  // A mosaic contains multiple image IDs; use its first image as a safe thumbnail fallback.
  const toImageUrl = (value) => {
    if (typeof value !== 'string' || !value) return undefined;
    if (value.startsWith('spotify:image:')) {
      return `https://i.scdn.co/image/${value.slice('spotify:image:'.length)}`;
    }
    if (value.startsWith('spotify:mosaic:')) {
      const firstImageId = value.slice('spotify:mosaic:'.length).split(':')[0];
      return firstImageId ? `https://i.scdn.co/image/${firstImageId}` : undefined;
    }
    return value;
  };

  const normalizeImages = (images) => (Array.isArray(images) ? images : images ? [images] : [])
    .map((image) => {
      const value = typeof image === 'string' ? image : image?.url || image?.uri;
      const url = toImageUrl(value);
      return url ? { url } : null;
    })
    .filter(Boolean);

  /** Shapes a track like the Spotify Web API does, which is what the overlay expects. */
  function mapTrack(item) {
    const meta = item.metadata || {};
    const images = (item.album && item.album.images) || item.images || [];
    const first = images[0] || {};
    const imageUrl = toImageUrl(first.url || first.uri || meta.image_xlarge_url || meta.image_large_url || meta.image_url);
    const artistNames = item.artists && item.artists.length ? item.artists.map((a) => a.name) : [meta.artist_name].filter(Boolean);

    return {
      id: (item.uri || '').split(':').pop(),
      uri: item.uri,
      name: item.name || meta.title || '',
      artists: artistNames.map((name) => ({ name })),
      album: { images: imageUrl ? [{ url: imageUrl }] : [] }
    };
  }

  /**
   * The looping video ("Canvas") of a song, if it has one. Spotify's player puts the link in the song's metadata.
   * Many songs have none, and some canvases are only pictures, which are skipped.
   */
  function canvasUrlOf(item) {
    const meta = (item && item.metadata) || {};
    const url = meta['canvas.url'];
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
    if (/image/i.test(String(meta['canvas.type'] || ''))) return null;
    return url;
  }

  function getState() {
    const data = player().data;
    const item = data && (data.item || data.track);
    if (!item || !item.uri) return null;

    const repeat = player().getRepeat(); // 0 off, 1 playlist, 2 song
    const isPlaying = typeof player().isPlaying === 'function' ? player().isPlaying() : !data.isPaused;
    const volume = baseVolume !== null ? baseVolume : player().getVolume(); // while fading, report the volume you chose
    const context = data.context || {};

    return {
      track: mapTrack(item),
      canvasUrl: canvasUrlOf(item),
      isPlaying: Boolean(isPlaying),
      isShuffled: Boolean(player().getShuffle()),
      repeatState: repeat === 2 ? 'track' : repeat === 1 ? 'context' : 'off',
      volume: Math.round((typeof volume === 'number' ? volume : 0.6) * 100),
      durationMs: player().getDuration() || (item.duration && item.duration.milliseconds) || item.duration_ms || 0,
      positionMs: player().getProgress() || 0,
      deviceId: null,
      deviceName: 'Spotify',
      contextUri: context.uri || data.context_uri || data.contextUri || null
    };
  }

  // ---------- starting songs ----------

  const isPlayingUri = (uri) => {
    const data = player().data;
    const item = data && (data.item || data.track);
    return Boolean(item && item.uri === uri);
  };

  /** Plays a playlist or album, starting at one song. Falls back step by step if Spotify ignores the song. */
  async function playContext(contextUri, trackUri) {
    const api = Spicetify.Platform.PlayerAPI;
    if (!trackUri) return player().playUri(contextUri);

    try {
      await api.play({ uri: contextUri }, {}, { skipTo: { uri: trackUri, trackUri } });
      await wait(PLAY_CHECK_MS);
      if (isPlayingUri(trackUri)) return;
    } catch (error) {
      console.warn('[fluxBridge] skipTo failed', error);
    }

    try {
      await Spicetify.CosmosAsync.put('https://api.spotify.com/v1/me/player/play', { context_uri: contextUri, offset: { uri: trackUri } });
      await wait(PLAY_CHECK_MS);
      if (isPlayingUri(trackUri)) return;
    } catch (error) {
      console.warn('[fluxBridge] web play failed', error);
    }

    await player().playUri(trackUri); // last resort: just the song
  }

  const isTrackUri = (uri) => typeof uri === 'string' && uri.startsWith('spotify:track:');

  /** The songs you added to the queue yourself. The rest of the playlist that is playing is not included. */
  function queuedEntries() {
    const next = (Spicetify.Queue && Spicetify.Queue.nextTracks) || [];
    return next.filter((entry) => ((entry && entry.contextTrack) || entry || {}).provider === 'queue' || (entry && entry.provider === 'queue'));
  }

  /**
   * Empties the queue. Spotify keeps the queue when a new playlist starts, which is how songs from an earlier
   * playlist or search ended up playing before the new one.
   */
  async function clearUserQueue() {
    const api = Spicetify.Platform && Spicetify.Platform.PlayerAPI;
    try {
      if (api && typeof api.clearQueue === 'function') await api.clearQueue();
    } catch (error) {
      console.warn('[fluxBridge] clearQueue failed', error);
    }

    // Make sure. If anything is left, remove it one by one with the documented call.
    await wait(150);
    const left = queuedEntries();
    if (left.length && typeof Spicetify.removeFromQueue === 'function') {
      try {
        await Spicetify.removeFromQueue(left.map((entry) => entry.contextTrack || entry));
      } catch (error) {
        console.warn('[fluxBridge] removeFromQueue failed', error);
      }
    }
  }

  async function waitUntilPlaying(uri, timeoutMs) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (isPlayingUri(uri)) return true;
      await wait(100);
    }
    return false;
  }

  /**
   * Plays a song from a list of search results, and carries on through the rest of that list:
   * the songs after it first, then the ones before it. Anything that was queued earlier is removed first.
   */
  async function playSongs(uris, startUri) {
    const tracks = uris.filter(isTrackUri);
    const index = tracks.indexOf(startUri);
    const rest = index >= 0 ? [...tracks.slice(index + 1), ...tracks.slice(0, index)] : tracks.filter((uri) => uri !== startUri);

    await clearUserQueue();
    await player().playUri(startUri);
    if (!rest.length) return;

    await waitUntilPlaying(startUri, 2000); // the queue is filled once the song has really started
    try {
      await Spicetify.Platform.PlayerAPI.addToQueue(rest.map((uri) => ({ uri })));
    } catch (error) {
      console.warn('[fluxBridge] could not queue the rest of the search results', error);
    }
  }

  // ---------- commands from the overlay ----------

  const commands = {
    async state() {
      return getState();
    },

    async configureCrossfade(args) {
      crossfadeConfig = {
        enabled: Boolean(args.enabled),
        seconds: Math.max(0, Math.min(12, Math.round(Number(args.seconds) || 0)))
      };
      storage.write(CROSSFADE_KEY, JSON.stringify(crossfadeConfig));
      if (!crossfadeConfig.enabled) restoreVolume();
      return { ...crossfadeConfig };
    },

    async play(request) {
      if (request.context_uri) {
        await clearUserQueue(); // songs queued earlier must not play before this playlist
        return playContext(request.context_uri, request.offset && request.offset.uri);
      }

      const uris = request.uris || [];
      const offset = request.offset || {};
      const startUri = offset.uri || uris[offset.position || 0] || uris[0];
      if (!startUri) throw new Error('Nothing to play.');
      return playSongs(uris, startUri);
    },

    async togglePlay(args) {
      if (typeof args.isPlaying === 'boolean') return args.isPlaying ? player().pause() : player().play();
      return player().togglePlay();
    },
    async next() {
      return player().next();
    },
    async previous() {
      return player().back();
    },
    async seek(args) {
      return player().seek(Math.max(0, Math.floor(args.positionMs)));
    },
    async volume(args) {
      const level = Math.max(0, Math.min(1, args.percent / 100));
      if (baseVolume !== null) {
        baseVolume = level; // a fade is running: change the volume it returns to
        storage.write(VOLUME_BACKUP_KEY, String(level));
        return null;
      }
      return player().setVolume(level);
    },
    async shuffle(args) {
      return player().setShuffle(Boolean(args.on));
    },
    async repeat(args) {
      return player().setRepeat(args.state === 'track' ? 2 : args.state === 'context' ? 1 : 0);
    },

    /**
     * Who is logged in and what kind of account it is. Read-only: nothing is changed.
     * Spotify's documented APIs only say premium or free. The exact plan (Individual, Duo, Family, Student) is
     * only shown if the app's own account settings happen to include it, so those settings are returned too.
     */
    async profile() {
      const platform = Spicetify.Platform || {};
      const account = { name: '', username: '', avatarUrl: '', plan: 'unknown', planLabel: '', details: {} };
      let product = '';

      // The name, from Spotify's own user service.
      try {
        const user = await platform.UserAPI.getUser();
        account.name = user.displayName || user.display_name || '';
        account.username = user.username || user.id || '';
        account.avatarUrl = (normalizeImages(user.images || user.avatars || user.avatar)[0] || {}).url || '';
      } catch (error) {
        /* try the next source */
      }

      // The web profile: name, id, and "premium" or "free".
      try {
        const me = await Spicetify.CosmosAsync.get('https://api.spotify.com/v1/me');
        account.name = account.name || me.display_name || '';
        account.username = account.username || me.id || '';
        account.avatarUrl = account.avatarUrl || (normalizeImages(me.images)[0] || {}).url || '';
        product = me.product || '';
      } catch (error) {
        /* try the next source */
      }

      // The app's own account settings ("product state"). Spotify renamed this in 1.2.21, so try both names.
      try {
        const service = platform.UserAPI._product_state_service || platform.UserAPI._product_state;
        const values = await service.getValues();
        const pairs = values.pairs || values;
        for (const [key, value] of Object.entries(pairs)) {
          if (PLAN_KEY.test(key) && typeof value === 'string' && value.length < 80 && Object.keys(account.details).length < 25) {
            account.details[key] = value;
          }
        }
        product = account.details.product || account.details.type || account.details.catalogue || product;
      } catch (error) {
        /* the web profile alone is enough for premium or free */
      }

      if (/premium/i.test(product)) account.plan = 'premium';
      else if (/^(free|open)$/i.test(product)) account.plan = 'free';

      // Which premium plan, if Spotify says.
      const tier = Object.values(account.details).join(' ').match(/family|duo|student|individual|mini|basic|lite/i);
      if (account.plan === 'premium') account.planLabel = tier ? `Premium ${tier[0][0].toUpperCase()}${tier[0].slice(1).toLowerCase()}` : 'Premium';
      if (account.plan === 'free') account.planLabel = 'Free';
      return account;
    },

    /** What is playing, the songs you queued, and what comes next from the playlist or album. */
    async queue() {
      const queue = Spicetify.Queue;
      if (!queue) return { current: null, queued: [], upNext: [] };

      // Some builds wrap each entry as { contextTrack }, others hand over the track directly.
      const itemOf = (entry) => (entry && entry.contextTrack) || entry;
      const asTrack = (entry) => {
        const item = itemOf(entry);
        return item && typeof item.uri === 'string' && item.uri.startsWith('spotify:track:') ? mapTrack(item) : null;
      };

      const queued = [];
      const upNext = [];
      for (const entry of queue.nextTracks || []) {
        const track = asTrack(entry);
        if (!track) continue; // skips the dividers Spotify puts between sections
        const item = itemOf(entry);
        ((item.provider || entry.provider) === 'queue' ? queued : upNext).push(track);
      }
      return { current: asTrack(queue.track), queued: queued.slice(0, 100), upNext: upNext.slice(0, 100) };
    },

    // Use Spotify's in-client APIs for browsing; the public Web API endpoints can be
    // restricted or changed independently of the player in newer Spotify builds.
    async libraryPlaylists() {
      const rootlistApi = Spicetify.Platform && Spicetify.Platform.RootlistAPI;
      if (!rootlistApi || typeof rootlistApi.getContents !== 'function') {
        throw new Error('Spicetify Platform.RootlistAPI.getContents is unavailable in this Spotify version.');
      }
      // Spotify removed the legacy sp://core-playlist/v1/rootlist resolver in some builds.
      const root = await rootlistApi.getContents();
      const playlists = [];
      const seen = new Set();

      const visit = (items) => {
        for (const row of items || []) {
          const item = row?.item || row;
          const children = item?.rows || item?.items || item?.children || item?.contents?.items;
          if (children) visit(children);

          const uri = item?.uri || item?.playlistUri || item?.link;
          if (!uri || !String(uri).startsWith('spotify:playlist:') || seen.has(uri)) continue;
          seen.add(uri);
          const id = String(uri).split(':').pop();
          const image = item.image_url || item.imageUrl || item.image || item.images?.[0]?.url;
          playlists.push({
            id, uri, name: item.name || item.title || item.metadata?.name || 'Untitled playlist',
            images: normalizeImages(image || item.images),
            items: { total: item.totalLength || item.trackCount || item.count || 0 },
            owner: item.owner || undefined,
            collaborative: Boolean(item.collaborative)
          });
        }
      };

      visit(root?.rows || root?.items || root?.contents?.items || []);
      return playlists;
    },
    async playlistTracks(args) {
      const uri = args.uri || `spotify:playlist:${args.id}`;
      const result = await Spicetify.Platform.PlaylistAPI.getContents(uri);
      const entries = result?.items || result?.contents?.items || result?.tracks?.items || [];
      return entries.map((entry) => {
        const item = entry?.item || entry?.track || entry;
        if (!item || !item.uri || !item.uri.startsWith('spotify:track:')) return null;
        const artists = item.artists || item.metadata?.artists || [];
        const image = item.album?.images || item.images || item.album?.image;
        return {
          // Always from the uri. item.uid only identifies the entry's place in the playlist, so it never equals
          // the id of the song that is playing, and nothing would be recognised as "playing".
          id: item.uri.split(':').pop(),
          uri: item.uri,
          name: item.name || item.title || item.metadata?.title || '',
          type: 'track',
          is_local: Boolean(item.is_local),
          duration_ms: item.duration_ms || item.duration?.milliseconds || 0,
          artists: artists.map((artist) => ({ name: typeof artist === 'string' ? artist : artist.name || artist.profile?.name || '' })).filter((artist) => artist.name),
          album: { images: normalizeImages(image) }
        };
      }).filter(Boolean);
    },
    async searchTracks(args) {
      const query = String(args.query || '').trim();
      if (!query) return [];

      const limit = Math.max(1, Math.min(50, Number(args.limit) || 10));
      const searchFailures = [];

      // Spotify changes the shape of search payloads between desktop versions.
      // Walk common wrappers instead of assuming every result is in tracks.items.
      const collectEntries = (value, depth = 0, found = [], seen = new Set()) => {
        if (!value || depth > 8) return found;
        if (Array.isArray(value)) {
          for (const item of value) collectEntries(item, depth + 1, found, seen);
          return found;
        }
        if (typeof value !== 'object' || seen.has(value)) return found;
        seen.add(value);

        const uri = value.uri || value.link?.uri || value.metadata?.uri || value.data?.uri;
        const id = value.id || value.uid || value.gid || value.trackId || value.metadata?.id;
        const name = value.name || value.title || value.metadata?.title || value.data?.name || value.data?.title;
        const looksLikeTrack = (typeof uri === 'string' && (uri.startsWith('spotify:track:') || /open\.spotify\.com\/track\//.test(uri))) ||
          (typeof id === 'string' && name) ||
          (value.type === 'track' && name);
        if (looksLikeTrack) found.push(value);

        // Spotify changes the names and nesting of search-result fields between client versions.
        // Walk nested objects instead of relying on a fixed list of wrapper keys.
        for (const child of Object.values(value)) {
          if (child && typeof child === 'object') collectEntries(child, depth + 1, found, seen);
        }
        return found;
      };

      const normalizeTrack = (entry) => {
        // Search results can wrap a real track in item/data/track objects. Prefer
        // the first object that actually contains both a track URI/ID and a title,
        // rather than blindly descending into data and losing fields from its parent.
        const candidates = [];
        const visited = new Set();
        const visit = (value, depth = 0) => {
          if (!value || typeof value !== 'object' || depth > 8 || visited.has(value)) return;
          visited.add(value);
          candidates.push(value);
          for (const key of ['track', 'item', 'data', 'content', 'entity', 'metadata']) {
            const child = value[key];
            if (child && typeof child === 'object') visit(child, depth + 1);
          }
        };
        visit(entry);

        const textValue = (value) => {
          if (typeof value === 'string') return value;
          if (!value || typeof value !== 'object') return '';
          return value.text || value.title || value.name || value.default || '';
        };
        const asTrackUri = (value) => {
          if (typeof value !== 'string') return '';
          const spotifyUri = value.match(/spotify:track:([A-Za-z0-9]+)/);
          if (spotifyUri) return `spotify:track:${spotifyUri[1]}`;
          const webUri = value.match(/open\.spotify\.com\/(?:intl-[^\/]+\/)?track\/([A-Za-z0-9]+)/);
          if (webUri) return `spotify:track:${webUri[1]}`;
          return '';
        };

        let item = null;
        let rawUri = '';
        let name = '';
        for (const candidate of candidates) {
          const meta = candidate.metadata || {};
          const uri = asTrackUri(candidate.uri || candidate.link?.uri || candidate.playableUri ||
            candidate.canonicalUri || meta.uri || candidate.data?.uri);
          const title = textValue(candidate.name) || textValue(candidate.title) ||
            textValue(meta.title) || textValue(candidate.data?.name) || textValue(candidate.data?.title);
          if (uri && title) {
            item = candidate;
            rawUri = uri;
            name = title;
            break;
          }
        }

        if (!item) {
          // Some Spotify builds expose a base62 track ID separately from the URI.
          for (const candidate of candidates) {
            const meta = candidate.metadata || {};
            const idValue = candidate.id || candidate.uid || candidate.gid || candidate.trackId || meta.id;
            const id = typeof idValue === 'string' && /^([A-Za-z0-9]{22})$/.test(idValue)
              ? idValue
              : typeof idValue === 'string' && /^spotify:track:[A-Za-z0-9]+$/.test(idValue)
                ? idValue.split(':').pop()
                : '';
            const title = textValue(candidate.name) || textValue(candidate.title) ||
              textValue(meta.title) || textValue(candidate.data?.name) || textValue(candidate.data?.title);
            if (id && title) {
              item = candidate;
              rawUri = `spotify:track:${id}`;
              name = title;
              break;
            }
          }
        }

        if (!item || !rawUri || !name) return null;
        const meta = item.metadata || {};
        const rawArtists = item.artists?.items || item.artists?.data || item.artists ||
          item.artistsNames || meta.artists || meta.artist_name || [];
        const artists = (Array.isArray(rawArtists) ? rawArtists : [rawArtists])
          .map((artist) => ({
            name: typeof artist === 'string'
              ? artist
              : textValue(artist?.name) || textValue(artist?.profile?.name) ||
                textValue(artist?.metadata?.name) || textValue(artist?.artistName)
          }))
          .filter((artist) => artist.name);
        if (!artists.length && typeof meta.artist_name === 'string') artists.push({ name: meta.artist_name });

        const image = item.album?.images || item.albumOfTrack?.coverArt?.sources ||
          item.images || item.album?.image || item.coverArt?.sources ||
          meta.image_xlarge_url || meta.image_large_url || meta.image_url;
        const id = rawUri.split(':').pop();
        return {
          id,
          uri: rawUri,
          name,
          type: 'track',
          is_local: Boolean(item.is_local || item.isLocal),
          duration_ms: item.duration_ms || item.duration?.milliseconds || item.duration?.totalMilliseconds || 0,
          artists,
          album: { images: normalizeImages(image) }
        };
      };

      // Spicetify v3 may not expose GraphQL.Definitions, so provide persisted
      // operations with known hashes and the variables required by each operation.
      // Both operations return data.searchV2.topResultsV2.itemsV2.
      const spotifyGraphQL = Spicetify.GraphQL;
      if (spotifyGraphQL && typeof spotifyGraphQL.Request === 'function') {
        const searchDefinitions = [
          {
            name: 'searchSuggestions',
            hash: '9fe3ad78e43a1684b3a9fabc741c5928928d4d30d7d8fd7fd193c7ebb4a544f4',
            variables: {
              query,
              limit: 30,
              numberOfTopResults: 30,
              offset: 0,
              includeAuthors: true,
              includeAlbumPreReleases: true,
              includeEpisodeContentRatingsV2: true
            }
          },
          {
            name: 'searchModalResults',
            hash: '5c10c8121738f9a0e7c685984d237cde29812448b2f87b8b94e85fb52f645fd0',
            variables: {
              searchTerm: query,
              limit: 50,
              numberOfTopResults: Math.min(50, Math.max(limit, limit * 4)),
              offset: 0,
              includeAudiobooks: true,
              includeAuthors: true,
              includePreRelease: true,
              includeArtistHasConcertsField: false
            }
          }
        ];

        for (const searchDefinition of searchDefinitions) {
          try {
            const definition = spotifyGraphQL.Definitions?.[searchDefinition.name] || {
              name: searchDefinition.name,
              operation: 'query',
              sha256Hash: searchDefinition.hash,
              value: null
            };
            const result = await spotifyGraphQL.Request(definition, searchDefinition.variables);
            const payload = result?.data || result;
            const items = payload?.searchV2?.topResultsV2?.itemsV2 ||
              payload?.searchV2?.tracksV2?.items ||
              payload?.searchV2?.tracks?.items ||
              [];
            const entries = items.map((entry) =>
              entry?.item?.data || entry?.data || entry?.track?.data || entry?.track || entry?.item || entry
            );
            const tracks = [...new Map(
              [...entries, ...collectEntries(payload)]
                .map(normalizeTrack)
                .filter((track) => track && track.uri)
                .map((track) => [track.uri, track])
            ).values()];
            if (tracks.length) {
              console.info('[fluxBridge] Spotify GraphQL search succeeded', {
                operation: searchDefinition.name,
                query,
                resultCount: tracks.length,
                itemCount: items.length
              });
              return tracks.slice(0, limit);
            }

            const detail = payload?.errors?.map((error) => error?.message || String(error)).join('; ');
            searchFailures.push(
              searchDefinition.name + ': no usable tracks' + (detail ? ' (' + detail + ')' : '')
            );
            console.warn('[fluxBridge] Spotify GraphQL search returned no usable tracks', {
              operation: searchDefinition.name,
              query,
              itemCount: items.length,
              errors: payload?.errors,
              payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : typeof payload,
              responsePreview: payload && typeof payload === 'object'
                ? JSON.stringify(payload, null, 2)?.slice(0, 1800)
                : String(payload)
            });
          } catch (error) {
            const detail = {
              name: error?.name,
              message: error?.message || String(error),
              status: error?.status || error?.statusCode || error?.response?.status,
              code: error?.code
            };
            searchFailures.push(
              searchDefinition.name + ': ' +
              (detail.status ? 'HTTP ' + detail.status + ' ' : '') + detail.message
            );
            console.warn('[fluxBridge] Spotify GraphQL request failed', {
              operation: searchDefinition.name,
              query,
              error: detail
            });
          }
        }
      }

      if (Spicetify.Search && typeof Spicetify.Search.search === 'function') {
        try {
          const result = await Spicetify.Search.search(query, ['track'], limit, 0);
          const tracks = [...new Map(
            collectEntries(result)
              .map(normalizeTrack)
              .filter((track) => track && track.uri)
              .map((track) => [track.uri, track])
          ).values()];
          if (tracks.length) return tracks.slice(0, limit);
          searchFailures.push('Spicetify.Search.search returned no normalizable tracks');
          console.warn('[fluxBridge] Search.search returned an unrecognized result shape', {
            query,
            isArray: Array.isArray(result),
            resultLength: Array.isArray(result) ? result.length : undefined,
            resultKeys: result && typeof result === 'object' ? Object.keys(result) : typeof result,
            firstItem: Array.isArray(result) ? result[0] : undefined,
            firstItemPreview: Array.isArray(result) && result.length
              ? JSON.stringify(result[0], null, 2)?.slice(0, 4000)
              : undefined,
            firstItemKeys: Array.isArray(result) && result[0] && typeof result[0] === 'object' ? Object.keys(result[0]) : undefined
          });
        } catch (error) {
          searchFailures.push(`Spicetify.Search.search: ${error?.message || String(error)}`);
          console.warn('[fluxBridge] client search failed; trying Spotify API', error);
        }
      }

      try {
        const result = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`
        );
        const tracks = [...new Map(
          collectEntries(result)
            .map(normalizeTrack)
            .filter((track) => track && track.uri)
            .map((track) => [track.uri, track])
        ).values()];
        if (tracks.length) return tracks.slice(0, limit);
        const apiError = result && typeof result === 'object' && (result.code || result.error || result.message);
        searchFailures.push(`Spotify Web API: ${result?.message || result?.error || (result?.code ? `code ${result.code}` : 'no recognizable tracks')}`);
        console.warn('[fluxBridge] Spotify API search returned no recognizable tracks', {
          query,
          resultKeys: result && typeof result === 'object' ? Object.keys(result) : typeof result,
          apiCode: result?.code,
          apiError: result?.error,
          apiMessage: result?.message,
          responsePreview: result && typeof result === 'object'
            ? JSON.stringify(result, null, 2)?.slice(0, 4000)
            : String(result)
        });
        if (apiError) throw new Error(`Spotify search failed: ${result.message || result.error || result.code}`);
        throw new Error('Spotify search returned no usable track results.');
      } catch (error) {
        const message = error?.message || String(error);
        console.error('[fluxBridge] Spotify API search failed', { query, error, earlierFailures: searchFailures });
        throw new Error(`${message}${searchFailures.length ? `. Earlier search failures: ${searchFailures.join(' | ')}` : ''}`);
      }
    },

    /** Spotify's web endpoints (search, playlists), sent with the Spotify app's own login. */
    async http(args) {
      const cosmos = Spicetify.CosmosAsync;
      const method = String(args.method || 'GET').toUpperCase();
      if (method === 'GET') return cosmos.get(args.url);
      if (method === 'POST') return cosmos.post(args.url, args.body);
      if (method === 'PUT') return cosmos.put(args.url, args.body);
      if (method === 'DELETE') return cosmos.del(args.url, args.body);
      throw new Error(`Unsupported method ${method}`);
    }
  };

  function describe(error) {
    const status = (error && (error.status || error.code || (error.error && error.error.status))) || undefined;
    const message =
      (error && (error.message || (error.error && error.error.message))) || (typeof error === 'string' ? error : 'Spotify refused the request.');
    return { message: String(message), status: typeof status === 'number' ? status : undefined };
  }

  // ---------- the connection ----------

  let socket = null;
  let retryTimer = 0;

  function scheduleReconnect() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, RETRY_MS);
  }

  function reply(payload) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  async function handleMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }
    if (!message || typeof message.id !== 'number') return;

    const run = commands[message.cmd];
    if (!run) return reply({ id: message.id, ok: false, error: { message: `Unknown command: ${message.cmd}` } });

    try {
      const data = await run(message.args || {});
      reply({ id: message.id, ok: true, data: data === undefined ? null : data });
    } catch (error) {
      console.warn('[fluxBridge]', message.cmd, 'failed', error);
      reply({ id: message.id, ok: false, error: describe(error) });
    }
  }

  function connect() {
    let connection;
    try {
      console.info('[fluxBridge] Connecting to Star Stream bridge:', ADDRESS);
      connection = new window.WebSocket(ADDRESS);
      socket = connection;
    } catch (error) {
      console.error('[fluxBridge] Could not create the bridge WebSocket:', error);
      scheduleReconnect();
      return;
    }

    connection.onopen = () => {
      console.info('[fluxBridge] Connected to Star Stream bridge.');
      connection.send(JSON.stringify({ type: 'hello', name: 'fluxBridge', version: 1, build: BRIDGE_BUILD }));
      console.info('[fluxBridge] Bridge build:', BRIDGE_BUILD);
    };
    connection.onmessage = handleMessage;
    connection.onerror = (event) => {
      console.error('[fluxBridge] WebSocket connection error. Check that Star Stream is running and listening on 127.0.0.1:52701.', event);
    };
    connection.onclose = (event) => {
      console.warn('[fluxBridge] WebSocket closed:', {
        code: event.code,
        reason: event.reason || '(no reason provided)',
        wasClean: event.wasClean
      });
      if (socket === connection) socket = null;
      scheduleReconnect();
    };
  }

  connect();
})();
