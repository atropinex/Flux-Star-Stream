/** Shown while the Spotify app is not connected: how to set up the Spicetify extension. */
export function LoginScreen() {
  return (
    <div className="login">
      <h2>Waiting for Spotify</h2>
      <ol className="steps">
        <li>Install Spicetify (spicetify.app) and start the Spotify desktop app.</li>
        <li>Copy <code>fluxBridge.js</code> into Spicetify's <code>Extensions</code> folder.</li>
        <li>Run <code>spicetify config extensions fluxBridge.js</code>, then <code>spicetify apply</code>.</li>
        <li>This screen closes by itself as soon as Spotify connects.</li>
      </ol>
    </div>
  );
}
