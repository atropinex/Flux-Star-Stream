import type { Device, PlaybackState, RepeatState, Track } from './types';
import { ApiError, spotifyRequest } from './spotifyApi';

interface PlayerResponse {
  item: (Track & { duration_ms: number }) | null;
  is_playing: boolean;
  shuffle_state: boolean;
  repeat_state: RepeatState;
  progress_ms: number;
  device?: { id: string | null; name: string; volume_percent: number | null };
  context?: { uri: string } | null;
}

/** The ways we ask Spotify to start playing. */
export type PlayRequest =
  | { context_uri: string; offset?: { uri: string } }
  | { uris: string[]; offset?: { position: number } };

const deviceQuery = (deviceId?: string | null, first = true) =>
  deviceId ? `${first ? '?' : '&'}device_id=${deviceId}` : '';

/** Reads what is playing on any of the user's devices. Returns null when nothing is. */
export async function fetchPlayback(): Promise<PlaybackState | null> {
  const data = await spotifyRequest<PlayerResponse>('/me/player');
  if (!data || !data.item) return null;

  return {
    track: data.item,
    isPlaying: data.is_playing,
    isShuffled: data.shuffle_state,
    repeatState: data.repeat_state ?? 'off',
    volume: data.device?.volume_percent ?? 60,
    durationMs: data.item.duration_ms,
    positionMs: data.progress_ms,
    syncedAt: Date.now(),
    deviceId: data.device?.id ?? null,
    deviceName: data.device?.name ?? '',
    contextUri: data.context?.uri ?? null
  };
}

/** Starts playback. With no device given, uses the active one (or this computer's Spotify app). */
export async function startPlayback(request: PlayRequest, deviceId: string | null = null): Promise<void> {
  try {
    await spotifyRequest(`/me/player/play${deviceQuery(deviceId)}`, 'PUT', request);
  } catch (error) {
    if (deviceId || !(error instanceof ApiError) || error.status !== 404) throw error;

    const devices = await fetchDevices();
    const device = devices.find((d) => d.id && d.type === 'Computer') ?? devices.find((d) => d.id);
    if (!device) throw new Error('Spotify is not running. Open the Spotify app first, then try again.');
    await spotifyRequest(`/me/player/play?device_id=${device.id}`, 'PUT', request);
  }
}

export async function fetchDevices(): Promise<Device[]> {
  const data = await spotifyRequest<{ devices: Device[] }>('/me/player/devices');
  return data?.devices ?? [];
}

export const togglePlay = (isPlaying: boolean) =>
  spotifyRequest(isPlaying ? '/me/player/pause' : '/me/player/play', 'PUT');

export const skipNext = () => spotifyRequest('/me/player/next', 'POST');
export const skipPrevious = () => spotifyRequest('/me/player/previous', 'POST');
export const setShuffle = (on: boolean) => spotifyRequest(`/me/player/shuffle?state=${on}`, 'PUT');
export const setRepeat = (state: RepeatState) => spotifyRequest(`/me/player/repeat?state=${state}`, 'PUT');
export const seekTo = (positionMs: number) => spotifyRequest(`/me/player/seek?position_ms=${positionMs}`, 'PUT');
export const setDeviceVolume = (percent: number, deviceId?: string | null) =>
  spotifyRequest(`/me/player/volume?volume_percent=${percent}${deviceQuery(deviceId, false)}`, 'PUT');
