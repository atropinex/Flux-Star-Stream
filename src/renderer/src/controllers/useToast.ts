import { useCallback, useRef, useState } from 'react';

const TOAST_DURATION_MS = 3000;

/** A short message that disappears by itself. */
export function useToast() {
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const timer = useRef(0);

  const show = useCallback((text: string) => {
    setMessage(text);
    setIsVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIsVisible(false), TOAST_DURATION_MS);
  }, []);

  return { message, isVisible, show };
}
