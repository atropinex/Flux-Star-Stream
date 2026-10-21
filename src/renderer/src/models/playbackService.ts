import type { PlaybackState, RepeatState } from './types';
import { bridge } from './spotifyApi';

/** The ways we ask Spotify to start playing. */
export type PlayRequest =
  | { context_uri: string; offset?: { uri: string } }
  | { uris: string[]; offset?: { position: number } };

/** What the Spicetify extension reports. We add the moment we received it. */
type PlayerSnapshot = Omit<PlaybackState, 'syncedAt'>;

/** Reads what the Spotify app is playing. Returns null when nothing is. */
export async function fetchPlayback(): Promise<PlaybackState | null> {
  const snapshot = (await bridge('state')) as PlayerSnapshot | null;
  if (!snapshot || !snapshot.track) return null;
  return { ...snapshot, syncedAt: Date.now() };
}

// Playback is controlled by the Spotify app itself (through Spicetify), not by Spotify's Web API.
export const startPlayback = (request: PlayRequest) => bridge('play', request);
export const togglePlay = (isPlaying: boolean) => bridge('togglePlay', { isPlaying });
export const skipNext = () => bridge('next');
export const skipPrevious = () => bridge('previous');
export const setShuffle = (on: boolean) => bridge('shuffle', { on });
export const setRepeat = (state: RepeatState) => bridge('repeat', { state });
export const seekTo = (positionMs: number) => bridge('seek', { positionMs });
export const setDeviceVolume = (percent: number) => bridge('volume', { percent });

/** Not needed any more (the Spotify app picks its own device). Kept so older code still compiles. */
export const fetchDevices = async (): Promise<never[]> => [];
