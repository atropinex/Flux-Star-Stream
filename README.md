# Flux-Star-Stream

Flux-Star-Stream is a desktop overlay and remote control for your existing Spotify account and Spotify Connect devices. It does not stream or replace Spotify audio playback.

## Sign in

The distributed app should ship with the developer-configured Spotify Client ID. Users then choose **Log in with Spotify** and authorize their own account; they should not need to create a Spotify Developer app or paste a Client ID.

For local development, set `BUILT_IN_CLIENT_ID` in `src/shared/spotifyConfig.ts` to the Client ID of your configured Spotify application. Register this exact redirect URI in that app:

```
http://127.0.0.1:5500/
```

Spotify application ownership, quota mode, and user access are controlled by Spotify. OAuth does not bypass Development Mode restrictions or guarantee that the app is approved for public distribution.

## Remote control

Flux-Star-Stream uses Spotify's Web API to read playback state and send controls to the user's Spotify playback device. Audio remains on Spotify's supported player/device. Playback-control capabilities and available devices depend on Spotify's current account and API restrictions; this app does not promise every playback action for every Free account.

## Web version

The current repository is an Electron desktop app. Its OAuth callback uses a local loopback server and cannot be reused as-is for a hosted web client. A web version needs a separate browser OAuth callback and an appropriate deployed backend/session strategy before it can be offered safely.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
