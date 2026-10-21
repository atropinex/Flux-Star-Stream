import type { BridgeReply } from '../../../shared/types';

const BASE_URL = 'https://api.spotify.com/v1';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Sends a command to Spotify through the Spicetify extension and returns its answer. */
export async function bridge(command: string, args?: unknown): Promise<unknown> {
  const reply: BridgeReply = await window.api.bridgeRequest(command, args);
  if (!reply.ok) throw new ApiError(reply.error.message, reply.error.status ?? 0);
  return reply.data;
}

/**
 * Asks Spotify's own web endpoints (search, playlists ...). The request runs inside the Spotify app, so it uses
 * the app's own login and there is no Client ID, no login screen and no Development Mode limits.
 * Returns null when Spotify has nothing to send back.
 */
export async function spotifyRequest<T = unknown>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown): Promise<T | null> {
  const url = path.startsWith('http') ? path : BASE_URL + path;
  const data = await bridge('http', { method, url, body });
  return (data ?? null) as T | null;
}

/** Turns any error into a message that is fine to show the user. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
