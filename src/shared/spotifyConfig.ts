// Fixed values. You do not need to edit this file: the Client ID is entered inside the app.
// The redirect URI must be added to your Spotify app in the dashboard, exactly as written.
export const REDIRECT_URI = 'http://127.0.0.1:5500/';

export const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming',
  'user-read-email',
  'user-read-private'
].join(' ');
