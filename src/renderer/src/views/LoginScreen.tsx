interface Props {
  isConfigured: boolean;
  onLogin: () => void;
}

/** Users only sign in to Spotify; the app developer configures the Spotify application once. */
export function LoginScreen({ isConfigured, onLogin }: Props) {
  return (
    <div className="login">
      <h2>Connect Spotify</h2>
      {isConfigured ? (
        <>
          <p>Sign in to your Spotify account to control playback on your Spotify devices.</p>
          <button onClick={onLogin}>Log in with Spotify</button>
        </>
      ) : (
        <p className="note">
          Spotify login is not configured for this build yet. The app developer needs to finish
          setting up the Spotify application. You do not need to create a Spotify Developer app.
        </p>
      )}
    </div>
  );
}
