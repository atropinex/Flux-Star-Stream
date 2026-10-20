import { useEffect, useState } from 'react';
import type { PlaybackState } from '../models/types';

const TICK_MS = 250;

/** Estimates the live position between polls so the progress bar moves smoothly. */
export function useProgress(playback: PlaybackState | null): number {
  const [positionMs, setPositionMs] = useState(0);

  useEffect(() => {
    if (!playback) return;

    const update = () => {
      const elapsed = playback.isPlaying ? Date.now() - playback.syncedAt : 0;
      setPositionMs(Math.min(playback.durationMs, playback.positionMs + elapsed));
    };
    update();
    const timer = setInterval(update, TICK_MS);
    return () => clearInterval(timer);
  }, [playback]);

  return positionMs;
}
