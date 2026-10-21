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

  // Spicetify loads extensions before Spotify is ready, so wait for it.
  if (!window.Spicetify || !Spicetify.Player || !Spicetify.Platform || !Spicetify.CosmosAsync) {
    setTimeout(FluxBridge, 300);
    return;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const player = () => Spicetify.Player;

  // ---------- what is playing ----------

  const toImageUrl = (value) => {
    if (!value) return undefined;
    return value.startsWith('spotify:image:') ? `https://i.scdn.co/image/${value.slice('spotify:image:'.length)}` : value;
  };

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
    try {
      socket = new WebSocket(ADDRESS);
    } catch (error) {
      scheduleReconnect();
      return;
    }
    socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', name: 'fluxBridge', version: 1 }));
    socket.onmessage = handleMessage;
    socket.onerror = () => {
      try {
        socket.close();
      } catch (error) {
        /* already closed */
      }
    };
    socket.onclose = scheduleReconnect; // the overlay may not be running yet, or was restarted
  }

  connect();
})();
