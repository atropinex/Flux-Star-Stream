import { WebSocket, WebSocketServer, type RawData } from 'ws';

/** The Spicetify extension connects to this port. It is written at the top of fluxBridge.js as well. */
export const BRIDGE_PORT = 52701;
export const BRIDGE_BUILD = 'search-results-v3';

export class BridgeError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

interface Pending {
  command: string;
  startedAt: number;
  resolve: (data: unknown) => void;
  reject: (error: BridgeError) => void;
  timer: NodeJS.Timeout;
}

interface BridgeClientInfo {
  name: string;
  version: number | null;
  build: string | null;
}

/** Web pages can open sockets to localhost too. Only Spotify's own pages may connect. */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || origin === 'null') return true; // not an ordinary web page
  try {
    const url = new URL(origin);
    return url.protocol === 'spotify:' || url.hostname === 'spotify.com' || url.hostname.endsWith('.spotify.com');
  } catch {
    return false;
  }
}

/**
 * A small server on this computer. The Spicetify extension inside the Spotify app connects to it, and every
 * request from the overlay (play, search, playlists ...) is sent through that connection and answered by Spotify.
 */
export class BridgeModel {
  private server: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private clientInfo: BridgeClientInfo | null = null;

  start(): void {
    if (this.server) return;

    this.server = new WebSocketServer({
      host: '127.0.0.1', // never reachable from other computers
      port: BRIDGE_PORT,
      verifyClient: (info: { origin: string }) => {
        const isAllowed = isAllowedOrigin(info.origin);
        if (!isAllowed) console.warn('[bridge] refused a connection from', info.origin);
        return isAllowed;
      }
    });
    this.server.on('connection', (socket) => this.attach(socket));
    this.server.on('error', (error) => console.error('[bridge]', error.message)); // e.g. the port is already in use
  }

  stop(): void {
    this.failAll('The overlay is closing.');
    this.server?.close();
    this.server = null;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /** Sends a command to Spotify and waits for its answer. */
  request(command: string, args: unknown = {}, timeoutMs = 10_000): Promise<unknown> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new BridgeError('Spotify is not connected. Open Spotify with the Spicetify extension enabled.'));
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError('Spotify did not answer in time.'));
      }, timeoutMs);
      this.pending.set(id, { command, startedAt: Date.now(), resolve, reject, timer });
      if (command === 'searchTracks') {
        if (this.clientInfo?.build && this.clientInfo.build !== BRIDGE_BUILD) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new BridgeError(
            `The installed Spicetify extension is outdated (build ${this.clientInfo.build}). Run the Flux Star Stream setup installer again, then fully restart Spotify.`
          ));
          return;
        }
        console.info('[bridge] Sending search request to Spotify.', { id, extensionBuild: this.clientInfo?.build ?? '(not verified yet)' });
      }
      socket.send(JSON.stringify({ id, cmd: command, args }));
    });
  }

  private attach(socket: WebSocket): void {
    this.socket?.close(); // if Spotify was restarted, the newest connection wins
    this.socket = socket;
    this.clientInfo = null;
    console.info('[bridge] Spotify extension connected; waiting for its version handshake.');

    socket.on('message', (raw) => this.handleMessage(raw));
    socket.on('error', () => socket.close());
    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.failAll('Spotify disconnected.');
    });
  }

  private handleMessage(raw: RawData): void {
    let message: { type?: unknown; name?: unknown; version?: unknown; build?: unknown; id?: unknown; ok?: boolean; data?: unknown; error?: { message?: string; status?: number } };
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message.type === 'hello' && message.name === 'fluxBridge') {
      this.clientInfo = {
        name: 'fluxBridge',
        version: typeof message.version === 'number' ? message.version : null,
        build: typeof message.build === 'string' ? message.build : null
      };
      if (this.clientInfo.build !== BRIDGE_BUILD) {
        console.error('[bridge] OUTDATED Spicetify extension detected.', {
          expectedBuild: BRIDGE_BUILD,
          installedBuild: this.clientInfo.build ?? '(build not reported)',
          installedProtocolVersion: this.clientInfo.version,
          action: 'Run the Flux Star Stream setup installer again, then restart Spotify.'
        });
      } else {
        console.info('[bridge] Spicetify extension version verified.', this.clientInfo);
      }
      return;
    }
    if (typeof message.id !== 'number') return;

    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);

    if (pending.command === 'searchTracks') {
      const data = message.data;
      console.info('[bridge] Search response received.', {
        elapsedMs: Date.now() - pending.startedAt,
        extensionBuild: this.clientInfo?.build ?? '(unknown)',
        ok: Boolean(message.ok),
        resultType: Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data,
        resultCount: Array.isArray(data) ? data.length : undefined,
        error: message.error?.message
      });
    }

    if (message.ok) pending.resolve(message.data ?? null);
    else pending.reject(new BridgeError(message.error?.message ?? 'Spotify refused the request.', message.error?.status));
  }

  private failAll(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new BridgeError(reason));
    }
    this.pending.clear();
  }
}
