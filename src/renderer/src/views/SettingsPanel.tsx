import { useEffect, useState } from 'react';
import type { AppSettings, Theme, UpdatableSettings } from '../../../shared/types';
import { describeAccelerator, toAccelerator } from '../utils/accelerator';
import { IconButton } from './IconButton';
import { CloseIcon } from './Icons';

interface Props {
  settings: AppSettings;
  themes: Theme[];
  themeErrors: string[];
  onShortcut: (accelerator: string) => Promise<boolean>;
  onUpdate: (changes: UpdatableSettings) => void;
  onReloadThemes: () => void;
  onError: (message: string) => void;
  onLogout: () => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, themes, themeErrors, onShortcut, onUpdate, onReloadThemes, onError, onLogout, onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') return setIsRecording(false);

      const accelerator = toAccelerator(event);
      if (!accelerator) return;
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
          <h3>Theme</h3>
          <select value={settings.theme} onChange={(event) => onUpdate({ theme: event.target.value })}>
            {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
          </select>
          <div className="settings-buttons">
            <button className="pill" onClick={() => window.api.openThemesFolder()}>Open themes folder</button>
            <button className="pill" onClick={onReloadThemes}>Reload</button>
          </div>
          <p className="note">Themes are YAML files in that folder. Edit one or copy it to make your own, then press Reload.</p>
          {themeErrors.map((message) => <p key={message} className="note error">{message}</p>)}
        </section>

        <section>
          <h3>Spotify app</h3>
          <label className="switch">
            Minimize it when the overlay opens
            <input type="checkbox" checked={settings.minimizeSpotify} onChange={(event) => onUpdate({ minimizeSpotify: event.target.checked })} />
          </label>
          <button className="pill" onClick={onLogout}>Disconnect Spotify account</button>
        </section>
      </aside>
    </div>
  );
}
