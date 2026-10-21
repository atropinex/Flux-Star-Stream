const BASE_URL = 'https://api.spotify.com/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Sends a request with the login token. Returns null when Spotify has nothing to send back. */
export async function spotifyRequest<T = unknown>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown
): Promise<T | null> {
  const token = await window.api.getToken();
  const url = path.startsWith('http') ? path : BASE_URL + path;

  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  // 202 / 204 mean "worked, nothing to return".
  if (response.status === 202 || response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error?.message ?? 'Request failed.', response.status);
  return data as T;
}

/** Turns any error into a message that is fine to show the user. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'Spotify Premium is required to control playback.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
