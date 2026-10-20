import { useEffect, useState } from 'react';
import type { AppSettings } from '../../../shared/types';
import { IconButton } from './IconButton';
import { CloseIcon } from './Icons';
import { describeAccelerator, toAccelerator } from '../utils/accelerator';

interface Props {
  settings: AppSettings;
  onShortcut: (accelerator: string) => Promise<boolean>;
  onMinimizeSpotify: (on: boolean) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onShortcut, onMinimizeSpotify, onError, onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false);

  // While recording, the next key combination becomes the new keybind.
  useEffect(() => {
    if (!isRecording) return;

    const handleKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') return setIsRecording(false);

      const accelerator = toAccelerator(event);
      if (!accelerator) return; // keep waiting for a full combination
      setIsRecording(false);
      onShortcut(accelerator).then((isAccepted) => {
        if (!isAccepted) onError('That keybind is taken by another app. Try a different one.');
      });
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isRecording, onShortcut, onError]);

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <aside className="settings" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <IconButton label="Close" onClick={onClose}><CloseIcon size={18} /></IconButton>
        </header>

        <section>
          <h3>Open / close keybind</h3>
          <button className={`shortcut${isRecording ? ' recording' : ''}`} onClick={() => setIsRecording(true)}>
            {isRecording ? 'Press the new keys…' : describeAccelerator(settings.shortcut)}
          </button>
          <p className="note">Click, then press the keys you want. It needs Ctrl, Alt or Shift. Esc cancels.</p>
        </section>

        <section>
          <h3>Spotify app</h3>
          <label className="switch">
            Minimize it when the overlay opens
            <input
              type="checkbox"
              checked={settings.minimizeSpotify}
              onChange={(event) => onMinimizeSpotify(event.target.checked)}
            />
          </label>
        </section>
      </aside>
    </div>
  );
}
