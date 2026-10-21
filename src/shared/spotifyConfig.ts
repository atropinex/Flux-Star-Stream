// Fixed values. You do not need to edit this file: the Client ID is entered inside the app.
// The redirect URI must be added to your Spotify app in the dashboard, exactly as written.
// Optional. Paste your own Spotify app's Client ID here before you share the app with other people.
// They then only see a "Log in" button and never need a developer account. Leave it empty to make
// each person enter their own Client ID in the app. (A Client ID is not a secret.)
export const BUILT_IN_CLIENT_ID = '';

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
