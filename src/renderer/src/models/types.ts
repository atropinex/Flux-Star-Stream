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
  artists: { name: string }[];
  album: { images: SpotifyImage[] };
}

export interface Device {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
}

/** What is playing, as the player bar needs it. */
export interface PlaybackState {
  track: Track;
  isPlaying: boolean;
  isShuffled: boolean;
  volume: number;
  durationMs: number;
  positionMs: number; // position at the moment we asked Spotify
  syncedAt: number;   // when we asked (ms since 1970), used to estimate the live position
  deviceId: string | null;
  deviceName: string;
  contextUri: string | null; // the playlist (or album) it is playing from
}
