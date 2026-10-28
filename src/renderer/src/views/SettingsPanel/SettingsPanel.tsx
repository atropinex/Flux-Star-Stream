import { useEffect, useState } from 'react';
import type { AppSettings, Theme, UpdatableSettings } from '../../../../shared/types';
import type { AccountInfo } from '../../models/types';
import { describeAccelerator, toAccelerator } from '../../utils/accelerator';
import { Avatar } from '../Avatar/Avatar';
import { IconButton } from '../IconButton/IconButton';
import { CloseIcon } from '../Icons';
import './SettingsPanel.css';

interface Props {
  settings: AppSettings;
  themes: Theme[];
  themeErrors: string[];
  account: AccountInfo | null;
  accountError: string | null;
  onShortcut: (accelerator: string) => Promise<boolean>;
  onUpdate: (changes: UpdatableSettings) => void;
  onReloadThemes: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, themes, themeErrors, account, accountError, onShortcut, onUpdate, onReloadThemes, onError, onClose }: Props) {
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
    <div className="settings-layer">
      <div className="settings-backdrop" onClick={onClose} />
      <aside className="settings">
        <header>
          <h2>Settings</h2>
          <IconButton label="Close" onClick={onClose}><CloseIcon size={18} /></IconButton>
        </header>

        <section>
          <h3>Account</h3>
          {accountError && <p className="note error">{accountError}</p>}
          {!account && !accountError && <p className="note">Loading…</p>}
          {account && (
            <>
              <div className="account">
                <Avatar url={account.avatarUrl} name={account.name || account.username || '?'} size={44} />
                <div className="account-name">{account.name || account.username || 'Unknown user'}</div>
                <span className={`plan-badge ${account.plan}`}>
                  {account.planLabel || 'Unknown plan'}
                </span>
              </div>
              {account.name && account.username && <p className="note">{account.username}</p>}
              {account.planLabel === 'Premium' && (
                <p className="note">Spotify does not say which Premium plan this is (Individual, Duo, Family or Student).</p>
              )}
              {Object.keys(account.details).length > 0 && (
                <details className="account-details">
                  <summary>Account details</summary>
                  <dl>
                    {Object.entries(account.details).map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                </details>
              )}
            </>
          )}
        </section>

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
          <h3>Playback</h3>
          <label className="switch">
            Smooth transition between songs
            <input type="checkbox" checked={settings.crossfadeEnabled} onChange={(event) => onUpdate({ crossfadeEnabled: event.target.checked })} />
          </label>
          <label className="slider">
            <span>Transition length <b>{settings.crossfadeSeconds}s</b></span>
            <input type="range" min="0" max="12" step="1" value={settings.crossfadeSeconds} disabled={!settings.crossfadeEnabled} onChange={(event) => onUpdate({ crossfadeSeconds: Number(event.target.value) })} />
          </label>
          <p className="note">The end of each song fades out and the next one fades in, so no song is ever cut short. This dips the volume, it does not overlap the songs. For a true overlap, turn on Spotify's own Crossfade (Settings → Playback) and switch this off, otherwise the volume fades twice. It is skipped while a single song is on repeat.</p>
          <p className="note">Equalizer controls aren't exposed by Spotify's current player API, so an in-app EQ can't be applied reliably.</p>
        </section>

        <section>
          <h3>Song video</h3>
          <label className="switch">
            Play the song's video on its banner
            <input type="checkbox" checked={settings.canvasVideo} onChange={(event) => onUpdate({ canvasVideo: event.target.checked })} />
          </label>
          <p className="note">
            Many songs have a short looping video (Spotify calls it Canvas). When the song that is playing has one, it plays muted on that
            song's banner and pauses with the music. Songs without one keep their cover. Spotify has to send the video, so if none ever
            shows up, check whether Spotify's own settings have a Canvas switch turned off.
          </p>
        </section>

        <section>
          <h3>Spotify app</h3>
          <label className="switch">
            Minimize it when the overlay opens
            <input type="checkbox" checked={settings.minimizeSpotify} onChange={(event) => onUpdate({ minimizeSpotify: event.target.checked })} />
          </label>
        </section>
      </aside>
    </div>
  );
}
