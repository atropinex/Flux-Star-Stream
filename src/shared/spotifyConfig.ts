// Configure this once for the distributed app. Users only need to sign in to Spotify;
// they should never have to create their own Spotify Developer app.
// Spotify still requires the app owner to configure/approve this application.
export const BUILT_IN_CLIENT_ID = '';

export const REDIRECT_URI = 'http://127.0.0.1:5500/';

// Request only the permissions used by the remote-control app.
// No "streaming" scope: Flux-Star-Stream controls Spotify Connect; it does not stream audio.
export const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-email',
  'user-read-private'
].join(' ');