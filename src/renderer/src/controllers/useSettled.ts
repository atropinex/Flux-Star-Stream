import { useEffect, useState } from 'react';

/**
 * A value that only changes once it has stopped changing for `delayMs`.
 * While you scroll quickly, text that depends on the selected card would restart its fade-in on every step and
 * flash. With this, it stays calm and fades in once, when you stop.
 */
export function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
