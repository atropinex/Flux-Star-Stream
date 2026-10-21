const BASE_URL = 'https://api.spotify.com/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Sends a request with the login token. Returns null when Spotify has nothing to send back. */
export async function spotifyRequest<T = unknown>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown
): Promise<T | null> {
  const token = await window.api.getToken();
  if (!token) throw new ApiError('Your Spotify session has expired. Please reconnect your account.', 401);

  const url = path.startsWith('http') ? path : BASE_URL + path;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  // 202 / 204 mean "worked, nothing to return".
  if (response.status === 202 || response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message ?? data.error_description ?? data.message ?? 'Spotify API request failed.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

/** Keep Spotify's actual API message visible instead of treating every 403 as a Premium error. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your Spotify session has expired or was not authorized. Please reconnect Spotify.';
    if (error.status === 403) {
      return `Spotify denied this action: ${error.message} Playback-control endpoints may require Premium, and app access or permissions can also cause a 403.`;
    }
    if (error.status === 429) return 'Spotify is rate-limiting requests. Wait a moment and try again.';
    return `Spotify API error (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
