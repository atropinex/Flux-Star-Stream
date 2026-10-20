import { useCallback, useEffect, useState } from 'react';
import { describeError } from '../models/spotifyApi';

export type AuthStatus = 'checking' | 'logged-out' | 'logged-in';

/** Knows whether the user is logged in, and can start the login. */
export function useAuth(onError: (message: string) => void) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    (async () => {
      setIsConfigured(await window.api.isConfigured());
      setStatus((await window.api.hasSession()) ? 'logged-in' : 'logged-out');
    })();
  }, []);

  const login = useCallback(async () => {
    try {
      await window.api.login();
      setStatus('logged-in');
    } catch (error) {
      onError(describeError(error));
    }
  }, [onError]);

  const saveClientId = useCallback(async (clientId: string) => {
    await window.api.setClientId(clientId);
    setIsConfigured(true);
    setStatus('logged-out');
  }, []);

  const changeClientId = useCallback(() => setIsConfigured(false), []);

  return { status, isConfigured, login, saveClientId, changeClientId };
}
