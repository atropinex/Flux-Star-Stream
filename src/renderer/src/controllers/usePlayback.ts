import { useCallback, useEffect, useState } from 'react';
import type { PlaybackState, RepeatState } from '../models/types';
import * as service from '../models/playbackService';
import { ApiError, describeError } from '../models/spotifyApi';

const POLL_INTERVAL_MS = 1500; // how often we ask Spotify what is playing (only while the overlay is open)
const REFRESH_DELAY_MS = 400;  // wait after a command before asking again

// Loop button order: off, then Loop 1 (the playlist), then Loop 2 (the song).
const NEXT_REPEAT: Record<RepeatState, RepeatState> = { off: 'context', context: 'track', track: 'off' };

/** The song a play request is about, so it can be opened in the Spotify app. */
function uriOf(request: service.PlayRequest): string {
  if ('context_uri' in request) return request.offset?.uri ?? request.context_uri;
  return request.uris[request.offset?.position ?? 0] ?? request.uris[0];
}

/** True when a new reading says nothing that the last one did not. The progress bar estimates the position itself. */
function isSamePlayback(a: PlaybackState, b: PlaybackState): boolean {
  const estimated = a.positionMs + (a.isPlaying ? b.syncedAt - a.syncedAt : 0);
  return (
    a.track.uri === b.track.uri &&
    a.isPlaying === b.isPlaying &&
    a.isShuffled === b.isShuffled &&
    a.repeatState === b.repeatState &&
    a.volume === b.volume &&
    a.durationMs === b.durationMs &&
    a.contextUri === b.contextUri &&
    Math.abs(b.positionMs - estimated) < 800 // a seek or a stall would be bigger than this
  );
}

/** What the Spotify app is playing, and the commands that control it. */
export function usePlayback(isActive: boolean, onError: (message: string) => void) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const latest = await service.fetchPlayback();
      if (latest) setPlayback((previous) => (previous && isSamePlayback(previous, latest) ? previous : latest));
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

    /** Spotify does not let apps control free accounts, so there the song is opened in the Spotify app instead. */
    async play(request: service.PlayRequest) {
      try {
        await service.startPlayback(request);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          window.api.openInSpotify(uriOf(request));
          onError('Free accounts cannot be controlled from here, so it was opened in the Spotify app.');
        } else {
          onError(describeError(error));
        }
        return;
      }
      setTimeout(refresh, REFRESH_DELAY_MS);
    },

    togglePlay: () => run(() => service.togglePlay(playback?.isPlaying ?? false)),
    next: () => run(service.skipNext),
    previous: () => run(service.skipPrevious),
    toggleShuffle: () => run(() => service.setShuffle(!playback?.isShuffled)),
    cycleRepeat: () => run(() => service.setRepeat(NEXT_REPEAT[playback?.repeatState ?? 'off'])),
    seekToFraction: (fraction: number) =>
      playback && run(() => service.seekTo(Math.floor(fraction * playback.durationMs))),
    setVolume: (percent: number) => run(() => service.setDeviceVolume(percent))
  };
}
