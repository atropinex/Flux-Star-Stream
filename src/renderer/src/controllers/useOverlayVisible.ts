import { useEffect, useState } from 'react';

/** True while the overlay is on screen. The main process tells us when it opens and closes. */
export function useOverlayVisible(): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => window.api.onVisibilityChange(setIsVisible), []);

  return isVisible;
}
