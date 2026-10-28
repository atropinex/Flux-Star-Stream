import { useCallback, useEffect, useState } from 'react';
import type { AccountInfo } from '../models/types';
import { fetchAccount } from '../models/libraryService';
import { describeError } from '../models/spotifyApi';

const RETRY_MS = 5000; // Spotify may not be running yet when the overlay opens, so try again until it answers

/** The logged-in user's profile (name, picture, plan). Loaded when the overlay opens. */
export function useAccount(isActive: boolean) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccount(await fetchAccount());
      setError(null);
    } catch (failure) {
      const message = describeError(failure);
      // An extension from before the account command existed does not know it.
      setError(
        /unknown command/i.test(message)
          ? 'Your Spicetify extension is out of date. Copy the new fluxBridge.js and run "spicetify apply".'
          : message
      );
    }
  }, []);

  useEffect(() => {
    if (isActive) void load();
  }, [isActive, load]);

  // Keep trying while there is nothing to show, but not forever once it works.
  const isComplete = Boolean(account && (account.name || account.username || account.plan !== 'unknown'));
  useEffect(() => {
    if (!isActive || isComplete) return;
    const timer = setInterval(load, RETRY_MS);
    return () => clearInterval(timer);
  }, [isActive, isComplete, load]);

  return { account, error };
}
