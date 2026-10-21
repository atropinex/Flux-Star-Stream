import { useEffect, useState } from 'react';

export type AuthStatus = 'checking' | 'logged-out' | 'logged-in';

const CHECK_INTERVAL_MS = 1500;

/**
 * Whether the Spotify app is connected through the Spicetify extension. There is no login any more:
 * the Spotify app is already logged in, and everything goes through it.
 * 'logged-in' means connected, 'logged-out' means waiting for Spotify.
 */
export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    let isStopped = false;

    const check = async () => {
      const isConnected = await window.api.isBridgeConnected().catch(() => false);
      if (!isStopped) setStatus(isConnected ? 'logged-in' : 'logged-out');
    };
    check();

    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      isStopped = true;
      clearInterval(timer);
    };
  }, []);

  return { status };
}
