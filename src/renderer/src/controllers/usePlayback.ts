import { useCallback, useEffect, useState } from 'react';
import type { PlaybackState } from '../models/types';
import * as service from '../models/playbackService';
import { describeError } from '../models/spotifyApi';

const POLL_INTERVAL_MS = 1500; // how often we ask Spotify what is playing (only while the overlay is open)
const REFRESH_DELAY_MS = 400;  // wait after a command before asking again

/** What the Spotify app is playing, and the commands that control it. */
export function usePlayback(isActive: boolean, onError: (message: string) => void) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const latest = await service.fetchPlayback();
      if (latest) setPlayback(latest);
    } catch {
      // A failed poll is not worth interrupting the user for.
    }
  }, []);

  // Refresh right away when the overlay opens, then keep polling while it is open.
  useEffect(() => {
    if (!isActive) return;
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isActive, refresh]);

  /** Runs a command, shows any error, then refreshes the player. */
  async function run(command: () => Promise<unknown>) {
    try {
      await command();
    } catch (error) {
      onError(describeError(error));
      return;
    }
    setTimeout(refresh, REFRESH_DELAY_MS);
  }

  return {
    playback,
    play: (request: service.PlayRequest) => run(() => service.startPlayback(request)),
    togglePlay: () => run(() => service.togglePlay(playback?.isPlaying ?? false)),
    next: () => run(service.skipNext),
    previous: () => run(service.skipPrevious),
    toggleShuffle: () => run(() => service.setShuffle(!playback?.isShuffled)),
    seekToFraction: (fraction: number) =>
      playback && run(() => service.seekTo(Math.floor(fraction * playback.durationMs))),
    setVolume: (percent: number) => run(() => service.setDeviceVolume(percent))
  };
}
