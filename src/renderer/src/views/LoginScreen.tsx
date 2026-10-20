import { useState } from 'react';
import { REDIRECT_URI } from '../../../shared/spotifyConfig';

interface Props {
  isConfigured: boolean;
  onLogin: () => void;
  onSaveClientId: (clientId: string) => void;
  onChangeClientId: () => void;
}

/** First run: ask for the Spotify Client ID. After that: the login button. */
export function LoginScreen({ isConfigured, onLogin, onSaveClientId, onChangeClientId }: Props) {
  const [clientId, setClientId] = useState('');

  if (isConfigured) {
    return (
      <div className="login">
        <h2>Connect Spotify</h2>
        <button onClick={onLogin}>Log in</button>
        <button className="link" onClick={onChangeClientId}>Change Client ID</button>
      </div>
    );
  }

  return (
    <div className="login">
      <h2>Set up Spotify</h2>
      <ol className="steps">
        <li>Create an app at developer.spotify.com/dashboard</li>
        <li>Add this redirect URI to it: <code>{REDIRECT_URI}</code></li>
        <li>Paste the app's Client ID here</li>
      </ol>
      <input
        placeholder="Client ID"
        value={clientId}
        onChange={(event) => setClientId(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && clientId.trim() && onSaveClientId(clientId)}
      />
      <button onClick={() => clientId.trim() && onSaveClientId(clientId)}>Save</button>
    </div>
  );
}
