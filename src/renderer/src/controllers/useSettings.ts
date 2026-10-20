import { useEffect, useState } from 'react';
import type { AppSettings } from '../../../shared/types';

/** The overlay's settings (keybind, minimize Spotify). They are saved by the main process. */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    window.api.getSettings().then(setSettings);
  }, []);

  /** Returns false when another app already uses that keybind. */
  async function changeShortcut(accelerator: string): Promise<boolean> {
    const isAccepted = await window.api.setShortcut(accelerator);
    if (isAccepted) setSettings((current) => current && { ...current, shortcut: accelerator });
    return isAccepted;
  }

  async function setMinimizeSpotify(on: boolean) {
    await window.api.setMinimizeSpotify(on);
    setSettings((current) => current && { ...current, minimizeSpotify: on });
  }

  return { settings, changeShortcut, setMinimizeSpotify };
}
