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
  const BRIDGE_BUILD = 'search-results-v5';

  // Spicetify loads extensions before Spotify is ready, so wait for it.
  if (!window.Spicetify || !Spicetify.Player || !Spicetify.Platform || !Spicetify.CosmosAsync) {
    setTimeout(FluxBridge, 300);
    return;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const player = () => Spicetify.Player;

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

  function getState() {
    const data = player().data;
    const item = data && (data.item || data.track);
    if (!item || !item.uri) return null;

    const repeat = player().getRepeat(); // 0 off, 1 playlist, 2 song
    const isPlaying = typeof player().isPlaying === 'function' ? player().isPlaying() : !data.isPaused;
    const volume = player().getVolume();
    const context = data.context || {};

    return {
      track: mapTrack(item),
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

  /** Plays one song, and puts the songs after it in the queue (search results). */
  async function playSongs(uris, startUri) {
    await player().playUri(startUri);

    const after = uris.slice(uris.indexOf(startUri) + 1);
    if (!after.length) return;
    try {
      const api = Spicetify.Platform.PlayerAPI;
      if (api.clearQueue) await api.clearQueue();
      await api.addToQueue(after.map((uri) => ({ uri })));
    } catch (error) {
      console.warn('[fluxBridge] could not queue the next songs', error);
    }
  }

  // ---------- commands from the overlay ----------

  const commands = {
    async state() {
      return getState();
    },

    async play(request) {
      if (request.context_uri) return playContext(request.context_uri, request.offset && request.offset.uri);

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
      return player().setVolume(Math.max(0, Math.min(1, args.percent / 100)));
    },
    async shuffle(args) {
      return player().setShuffle(Boolean(args.on));
    },
    async repeat(args) {
      return player().setRepeat(args.state === 'track' ? 2 : args.state === 'context' ? 1 : 0);
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
          id: item.id || item.uid || item.uri.split(':').pop(),
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

      // Prefer Spotify's own authenticated GraphQL search operation. The undocumented
      // Spicetify.Search helper is not consistently present across Spotify desktop builds,
      // and the public Web API fallback has recently returned 429 for this app.
      const graphQL = Spicetify.GraphQL;
      const searchDefinition = graphQL?.Definitions?.searchModalResults;
      if (searchDefinition && typeof graphQL.Request === 'function') {
        try {
          const operation = searchDefinition.definitions?.find((definition) => definition.kind === 'OperationDefinition');
          const declaredVariables = operation?.variableDefinitions || [];
          const variables = {};
          let hasUnsupportedRequiredVariable = false;

          const namedType = (type) => {
            if (!type) return '';
            if (type.name?.value) return type.name.value;
            return namedType(type.type);
          };

          for (const definition of declaredVariables) {
            const name = definition.variable?.name?.value;
            if (!name) continue;
            const normalizedName = name.toLowerCase();
            const typeName = namedType(definition.type);
            const required = definition.type?.kind === 'NonNullType' || JSON.stringify(definition.type || {}).includes('"kind":"NonNullType"');
            if (/query|searchterm|searchquery|term|keywords/.test(normalizedName)) {
              variables[name] = query;
            } else if (/offset|startindex|start_index/.test(normalizedName)) {
              variables[name] = 0;
            } else if (/limit|count|pagesize|page_size|topresults|numberoftop/.test(normalizedName)) {
              variables[name] = limit;
            } else if (/include.*audiobook/.test(normalizedName)) {
              variables[name] = false;
            } else if (/include.*track/.test(normalizedName)) {
              variables[name] = true;
            } else if (/locale|language/.test(normalizedName)) {
              variables[name] = graphQL.Context?.locale || 'en';
            } else if (required) {
              // Don't send invented values to a private query if this Spotify build changed
              // its signature. Try the documented client helper and Web API fallback instead.
              hasUnsupportedRequiredVariable = true;
              console.warn('[fluxBridge] Unsupported required search GraphQL variable', { name, typeName });
            }
          }

          if (!hasUnsupportedRequiredVariable && declaredVariables.length) {
            const result = await graphQL.Request(searchDefinition, variables);
            const tracks = [...new Map(
              collectEntries(result)
                .map(normalizeTrack)
                .filter((track) => track && track.uri)
                .map((track) => [track.uri, track])
            ).values()];
            if (tracks.length) {
              console.info('[fluxBridge] GraphQL search succeeded', { query, resultCount: tracks.length });
              return tracks.slice(0, limit);
            }
            searchFailures.push('searchModalResults returned no normalizable tracks');
            console.warn('[fluxBridge] GraphQL search returned no recognizable tracks', {
              query,
              topLevelKeys: result && typeof result === 'object' ? Object.keys(result) : typeof result,
              resultPreview: result && typeof result === 'object'
                ? JSON.stringify(result, null, 2)?.slice(0, 2500)
                : String(result)
            });
          } else {
            console.warn('[fluxBridge] GraphQL search definition has no supported variable signature', {
              query,
              variables: declaredVariables.map((item) => ({
                name: item.variable?.name?.value,
                type: namedType(item.type),
                required: item.type?.kind === 'NonNullType'
              }))
            });
          }
        } catch (error) {
          searchFailures.push(`searchModalResults: ${error?.message || String(error)}`);
          console.warn('[fluxBridge] Native GraphQL search failed; trying other search paths.', error);
        }
      } else {
        console.warn('[fluxBridge] searchModalResults GraphQL definition is unavailable in this Spotify build.');
      }

      // Spotify's persisted operation hash changes with web-player releases. Prefer the
      // definition bundled by Spotify, try known real hashes, then discover the current
      // hash from Spotify's own search JavaScript chunk instead of guessing one.
      const spotifyGraphQL = Spicetify.GraphQL;
      if (spotifyGraphQL && typeof spotifyGraphQL.Request === 'function') {
        const queryVariables = {
          searchTerm: query,
          offset: 0,
          limit,
          numberOfTopResults: Math.min(limit, 5),
          includeAudiobooks: false
        };
        const getGraphQLError = (error) => ({
          name: error?.name,
          message: error?.message || String(error),
          status: error?.status || error?.statusCode,
          code: error?.code,
          url: error?.url || error?.request?.url
        });
        const getTrackItems = (payload) =>
          payload?.searchV2?.tracksV2?.items ||
          payload?.searchV2?.tracks?.items ||
          payload?.search?.tracksV2?.items ||
          payload?.search?.tracks?.items ||
          payload?.tracksV2?.items ||
          payload?.tracks?.items ||
          [];
        const parseSearchResponse = (result, source) => {
          const payload = result?.data || result;
          const trackItems = getTrackItems(payload);
          const entries = trackItems.map((item) =>
            item?.item?.data || item?.data || item?.track?.data || item?.track || item?.item || item
          );
          const tracks = [...new Map(
            [...entries, ...collectEntries(payload)]
              .map(normalizeTrack)
              .filter((track) => track && track.uri)
              .map((track) => [track.uri, track])
          ).values()];
          if (tracks.length) {
            console.info('[fluxBridge] Spotify GraphQL search succeeded', {
              source,
              query,
              resultCount: tracks.length,
              trackItemCount: trackItems.length
            });
            return tracks.slice(0, limit);
          }
          searchFailures.push(`${source}: no usable tracks (track items: ${trackItems.length})`);
          console.warn('[fluxBridge] Spotify GraphQL response contained no usable tracks', {
            source,
            query,
            payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : typeof payload,
            errors: payload?.errors,
            trackItemCount: trackItems.length,
            responsePreview: payload && typeof payload === 'object'
              ? JSON.stringify(payload, null, 2)?.slice(0, 1800)
              : String(payload)
          });
          return null;
        };

        const getSearchDesktopHashFromWebPlayer = async () => {
          try {
            const homeResponse = await fetch('https://open.spotify.com/', { headers: { accept: 'text/html' } });
            if (!homeResponse.ok) throw new Error(`Spotify web player page returned HTTP ${homeResponse.status}`);
            const html = await homeResponse.text();
            const mainUrl = html.match(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/web-player\.[\w.-]+\.js/)?.[0];
            if (!mainUrl) throw new Error('Could not find the current web-player bundle URL.');
            const mainResponse = await fetch(mainUrl, { headers: { referer: 'https://open.spotify.com/' } });
            if (!mainResponse.ok) throw new Error(`Spotify web-player bundle returned HTTP ${mainResponse.status}`);
            const mainScript = await mainResponse.text();
            const searchUrls = [...new Set(
              [...mainScript.matchAll(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/[\w.-]*search[\w.-]*\.js/g)]
                .map((match) => match[0])
            )];
            for (const url of searchUrls) {
              const response = await fetch(url, { headers: { referer: 'https://open.spotify.com/' } });
              if (!response.ok) continue;
              const script = await response.text();
              const hash = script.match(/["']searchDesktop["']\s*,\s*["']query["']\s*,\s*["']([a-f0-9]{64})["']/i)?.[1];
              if (hash) {
                console.info('[fluxBridge] Discovered current searchDesktop hash from Spotify web player.');
                return hash;
              }
            }
            throw new Error(`No searchDesktop hash found in ${searchUrls.length} search bundle(s).`);
          } catch (error) {
            console.warn('[fluxBridge] Could not discover the current Spotify search hash.', getGraphQLError(error));
            return null;
          }
        };

        const attempts = [];
        const bundledDefinition = spotifyGraphQL.Definitions?.searchDesktop;
        if (bundledDefinition) attempts.push({
          source: 'bundled searchDesktop definition',
          definition: bundledDefinition
        });
        const knownHashes = [
          'eff59fa0a3d026b88b56fddbcf4bdfa16a186b8175a5c1a358c072e053c2e5b0',
          '21b3fe49546912ba782db5c47e9ef5a7dbd20329520ba0c7d0fcfadee671d24e',
          '75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec'
        ];
        for (const hash of knownHashes) attempts.push({
          source: `searchDesktop hash ${hash.slice(0, 8)}`,
          definition: { name: 'searchDesktop', operation: 'query', sha256Hash: hash, value: null }
        });

        const triedHashes = new Set();
        const tryDefinition = async (attempt) => {
          try {
            const result = await spotifyGraphQL.Request(attempt.definition, queryVariables);
            return parseSearchResponse(result, attempt.source);
          } catch (error) {
            const detail = getGraphQLError(error);
            searchFailures.push(`${attempt.source}: ${detail.status ? `HTTP ${detail.status} ` : ''}${detail.message}`);
            console.warn('[fluxBridge] Spotify GraphQL request failed.', {
              source: attempt.source,
              query,
              error: detail
            });
            return null;
          }
        };

        for (const attempt of attempts) {
          const hash = attempt.definition?.sha256Hash;
          if (hash && triedHashes.has(hash)) continue;
          if (hash) triedHashes.add(hash);
          const tracks = await tryDefinition(attempt);
          if (tracks?.length) return tracks;
        }

        const discoveredHash = await getSearchDesktopHashFromWebPlayer();
        if (discoveredHash && !triedHashes.has(discoveredHash)) {
          const tracks = await tryDefinition({
            source: `discovered searchDesktop hash ${discoveredHash.slice(0, 8)}`,
            definition: { name: 'searchDesktop', operation: 'query', sha256Hash: discoveredHash, value: null }
          });
          if (tracks?.length) return tracks;
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
        if (apiError) throw new Error(`Spotify search failed: ${result.message || result.error || result.code}. ${searchFailures.join(' | ')}`);
        throw new Error(`Spotify search returned no usable track results. ${searchFailures.join(' | ')}`);
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
