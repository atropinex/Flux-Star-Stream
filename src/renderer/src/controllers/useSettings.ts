import { useEffect, useState } from 'react';
import type { AppSettings, UpdatableSettings } from '../../../shared/types';

/** The overlay's settings. They are saved by the main process. */
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

  /** Changes any other setting. The screen updates first, so sliders feel instant. */
  async function update(changes: UpdatableSettings) {
    setSettings((current) => current && { ...current, ...changes });
    await window.api.updateSettings(changes);
  }

  return { settings, changeShortcut, update };
}
