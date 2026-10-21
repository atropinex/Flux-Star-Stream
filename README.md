# Flux Star Stream

**Flux Star Stream** is a desktop overlay and remote control for Spotify. It lets you view and control playback from a separate desktop interface while Spotify continues to handle the actual audio playback.

- **Desktop app:** Electron, React, TypeScript, and Vite.
- **Spotify integration:** Spotify Web API for account authorization and supported playback controls.
- **Optional Spicetify bridge:** Connects the app to the Spotify desktop client for playback state, library browsing, track search, and playback commands.
- **Local-only bridge:** The app and Spicetify extension communicate over WebSocket at `127.0.0.1:52701`.

Flux Star Stream does not host music, replace Spotify, or stream audio itself.

## Contents

- [Requirements](#requirements)
- [Install and run from source](#install-and-run-from-source)
- [Connect Spotify](#connect-spotify)
- [Install the optional Spicetify bridge](#install-the-optional-spicetify-bridge)
- [Build the app](#build-the-app)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Development commands](#development-commands)
- [Privacy and limitations](#privacy-and-limitations)

## Requirements

Install these before setting up the project:

1. **Node.js** — use a current LTS release.
2. **npm** — included with Node.js.
3. **Spotify desktop app** — needed for Spotify playback and for the optional Spicetify bridge.
4. **Spicetify** — optional; needed only if you want to use the in-client bridge for library browsing and playback integration.
5. **Git** — optional, but recommended for cloning and updating the source.

Check the first two installations:

```bash
node --version
npm --version
```

## Install and run from source

### 1. Get the repository

Clone the project and enter its directory:

```bash
git clone https://github.com/atropinex/Flux-Star-Stream.git
cd Flux-Star-Stream
```

If you already have the repository, open a terminal in the project folder and update the branch you want to run.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Spotify OAuth

The app uses Spotify OAuth to authorize the user's own Spotify account.

For local development:

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create or select the Spotify application you will use for development.
3. In the app's settings, add this exact redirect URI:

   ```text
   http://127.0.0.1:5500/
   ```

4. Set `BUILT_IN_CLIENT_ID` in `src/shared/spotifyConfig.ts` to that Spotify application's Client ID.

The redirect URI must match exactly, including the IP address, port, and trailing slash. Do not commit client secrets, access tokens, or refresh tokens to the repository.

Spotify controls the app's Development Mode, quota mode, eligible users, and API permissions. Creating an OAuth app does not bypass those restrictions.

### 4. Start the desktop app

```bash
npm run dev
```

When the app opens, choose **Log in with Spotify** and authorize the account you want to use.

## Connect Spotify

Flux Star Stream controls Spotify playback; it does not play audio independently. Spotify must be available and have a playable device for playback actions to work.

Depending on the Spotify account, device, and current API restrictions, some playback controls may not be available. The app does not guarantee that every playback action works with every account type.

## Install the optional Spicetify bridge

The bridge is an optional Spicetify extension located at `spicetify/fluxBridge.js`. It lets Flux Star Stream communicate with the Spotify desktop client using Spicetify's in-client APIs. It is especially useful for browsing playlists and searching tracks without relying exclusively on the public Web API.

### 1. Install Spotify and Spicetify

Install the Spotify desktop app and follow the official Spicetify installation instructions:

- [Spicetify documentation](https://spicetify.app/docs/)

Run the following command to see your configured Spicetify extension directory:

```bash
spicetify path userdata
```

The extensions folder is normally inside the Spicetify user data directory, under `Extensions`. If you are unsure of the exact path, check your Spicetify configuration and documentation.

### 2. Copy the bridge file

Copy `spicetify/fluxBridge.js` from this repository into your Spicetify `Extensions` folder. Make sure the installed filename is exactly:

```text
fluxBridge.js
```

For example, on Windows the destination is commonly similar to:

```text
% AppData %\Roaming\spicetify\Extensions\fluxBridge.js
```

Use the actual path reported by your Spicetify installation if it differs.

### 3. Enable the extension

Run these commands in a terminal:

```bash
spicetify config extensions fluxBridge.js
spicetify apply
```

If you already have other Spicetify extensions configured, preserve their entries when changing the extension configuration. Do not replace the entire extensions list unintentionally.

Restart Spotify after applying the configuration if the extension does not load.

### 4. Start Flux Star Stream

Start the desktop app with `npm run dev`. The bridge reconnects automatically while it is running and attempts to connect to the app at:

```text
ws://127.0.0.1:52701
```

Keep Spotify and Flux Star Stream running on the same computer. The bridge is designed for local communication and is not intended to be exposed to the network.

### Updating the bridge

When the repository's `spicetify/fluxBridge.js` changes, copy the updated file into the Spicetify `Extensions` folder and run:

```bash
spicetify apply
```

Then restart Spotify if necessary.

## Build the app

To type-check the project:

```bash
npm run typecheck
```

To build the Electron app's project output:

```bash
npm run build
```

The current package scripts provide development and build commands. A packaged, end-user installer is not configured by these scripts alone; creating a distributable installer will require adding and configuring an Electron packaging tool.

## Troubleshooting

### The app cannot connect to the bridge

- Confirm that Spotify is open and Spicetify is installed.
- Confirm that `fluxBridge.js` is in the configured Spicetify `Extensions` folder.
- Run `spicetify config extensions` to inspect the configured extensions, then run `spicetify apply`.
- Restart Spotify and Flux Star Stream.
- Check that the local WebSocket port `52701` is not blocked by another process or security software.

### Playlist browsing or track search fails

- Confirm that the installed `fluxBridge.js` matches the version in this repository.
- Check Spotify's developer console for `[fluxBridge]` errors.
- Spicetify APIs can change between Spotify versions. An unavailable API may require updating the bridge to match the installed Spotify client.

### Images show `ERR_UNKNOWN_URL_SCHEME`

Spotify may return internal image identifiers such as `spotify:image:` or `spotify:mosaic:`. These are not standard browser image URLs. Use the image normalization in the repository's current `spicetify/fluxBridge.js` and make sure that updated file has been copied into the installed Extensions folder before running `spicetify apply`.

### Spotify login fails

- Verify that the redirect URI in the Spotify Developer Dashboard is exactly `http://127.0.0.1:5500/`.
- Verify that `BUILT_IN_CLIENT_ID` in `src/shared/spotifyConfig.ts` is the Client ID for the intended Spotify application.
- Check whether Spotify Development Mode, account eligibility, or API access restrictions apply.

## Project structure

```text
Flux-Star-Stream/
├── spicetify/
│   └── fluxBridge.js       # Optional Spotify desktop-client bridge
├── src/
│   ├── main/               # Electron main process
│   ├── renderer/            # React user interface
│   └── shared/              # Shared configuration and types
├── package.json
└── README.md
```

## Development commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install project dependencies |
| `npm run dev` | Start the app in development mode |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run build` | Build the Electron app output |
| `spicetify apply` | Apply Spicetify configuration and extensions |

## Privacy and limitations

- Flux Star Stream uses Spotify's authentication and APIs; Spotify's account and API policies still apply.
- Do not publish Spotify client secrets, access tokens, or refresh tokens.
- The Spicetify bridge listens for commands from the local app over loopback WebSocket. Do not expose this local bridge publicly.
- Spotify and Spicetify APIs can change. Compatibility may depend on the installed Spotify desktop and Spicetify versions.
- This project is an independent community project and is not affiliated with or endorsed by Spotify.
