import { useCallback, useEffect, useState } from 'react';
import type { QueueInfo } from '../models/types';
import { fetchQueue } from '../models/libraryService';
import { describeError } from '../models/spotifyApi';

const POLL_INTERVAL_MS = 2000; // songs can be queued from Spotify itself, so check now and then while the panel is open

const signature = (queue: QueueInfo) =>
  [queue.current, ...queue.queued, ...queue.upNext].map((track) => track?.uri ?? '').join('|');

/** The play queue. Only loaded and refreshed while the queue panel is open. */
export function useQueue(isOpen: boolean, currentUri: string | undefined) {
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const latest = await fetchQueue();
      setError(null);
      // Keep the old object when nothing changed, so the panel does not re-render for nothing.
      setQueue((previous) => (previous && signature(previous) === signature(latest) ? previous : latest));
    } catch (failure) {
      const message = describeError(failure);
      // An extension from before the queue existed does not know the command.
      setError(
        /unknown command/i.test(message)
          ? 'Your Spicetify extension is out of date. Copy the new fluxBridge.js and run "spicetify apply".'
          : message
      );
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isOpen, refresh]);

  // A new song started, so the queue moved on.
  useEffect(() => {
    if (isOpen) void refresh();
  }, [currentUri, isOpen, refresh]);

  return { queue, isLoading, error };
}
