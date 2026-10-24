export interface SpotifyImage {
  url: string;
}

export interface Playlist {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[] | null;
  items?: { total: number };  // called "tracks" before Spotify's February 2026 update
  tracks?: { total: number };
  collaborative?: boolean;
  owner?: { id: string; display_name: string | null };
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  type?: string;
  is_local?: boolean;
  duration_ms?: number;
  artists: { name: string }[];
  album: { images: SpotifyImage[] };
}

export interface Device {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent?: number | null;
}

export type RepeatState = 'off' | 'context' | 'track'; // 'context' = loop the playlist

/** The play queue, split the way Spotify shows it. */
export interface QueueInfo {
  current: Track | null;
  queued: Track[]; // songs added to the queue by hand
  upNext: Track[]; // what comes next from the playlist or album
}

/** What is playing, as the player bar needs it. */
export interface PlaybackState {
  track: Track;
  isPlaying: boolean;
  isShuffled: boolean;
  repeatState: RepeatState;
  volume: number;
  durationMs: number;
  positionMs: number; // position at the moment we asked Spotify
  syncedAt: number;   // when we asked (ms since 1970), used to estimate the live position
  deviceId: string | null;
  deviceName: string;
  contextUri: string | null; // the playlist (or album) it is playing from
}
