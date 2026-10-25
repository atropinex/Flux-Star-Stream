import { useEffect, useState } from 'react';
import type { AccountInfo } from '../models/types';
import { fetchAccount } from '../models/libraryService';
import { describeError } from '../models/spotifyApi';

/** The logged-in user's name and plan. Read again each time the settings open. */
export function useAccount(isOpen: boolean) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    fetchAccount()
      .then((loaded) => {
        if (isCancelled) return;
        setAccount(loaded);
        setError(null);
      })
      .catch((failure) => {
        if (isCancelled) return;
        const message = describeError(failure);
        // An extension from before the account command existed does not know it.
        setError(
          /unknown command/i.test(message)
            ? 'Your Spicetify extension is out of date. Copy the new fluxBridge.js and run "spicetify apply".'
            : message
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  return { account, error };
}
