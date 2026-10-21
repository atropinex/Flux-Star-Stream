import { app, shell } from 'electron';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BUILT_IN_CLIENT_ID, REDIRECT_URI, SCOPES } from '../../shared/spotifyConfig';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTH_URL = 'https://accounts.spotify.com/authorize';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error_description?: string;
  error?: string;
}

const toBase64Url = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Handles Spotify account login (PKCE) and stores tokens locally for the desktop app. */
export class AuthModel {
  private tokenFile = join(app.getPath('userData'), 'tokens.json');
  private clientFile = join(app.getPath('userData'), 'client-id.txt');
  private clientId = BUILT_IN_CLIENT_ID || this.loadClientId();
  private tokens: Tokens | null = this.loadTokens();

  isConfigured(): boolean {
    return this.clientId !== '';
  }

  usesBuiltInClientId(): boolean {
    return BUILT_IN_CLIENT_ID !== '';
  }

  /** Legacy developer override. Distributed builds should configure BUILT_IN_CLIENT_ID. */
  setClientId(clientId: string): void {
    if (this.usesBuiltInClientId()) return;
    this.clientId = clientId.trim();
    writeFileSync(this.clientFile, this.clientId, { mode: 0o600 });
    rmSync(this.tokenFile, { force: true });
    this.tokens = null;
  }

  hasSession(): boolean {
    return this.tokens !== null;
  }

  logout(): void {
    this.tokens = null;
    rmSync(this.tokenFile, { force: true });
  }

  /** Returns a valid access token, refreshing it when needed. Null if logged out. */
  async getAccessToken(): Promise<string | null> {
    if (!this.tokens) return null;
    if (Date.now() < this.tokens.expiresAt) return this.tokens.accessToken;

    try {
      return await this.requestTokens({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken
      });
    } catch {
      this.logout();
      return null;
    }
  }

  /** Opens Spotify login, validates the callback, then stores the granted tokens. */
  async login(): Promise<void> {
    if (!this.clientId) throw new Error('Spotify login has not been configured by the app developer yet.');

    const verifier = toBase64Url(randomBytes(48));
    const challenge = toBase64Url(createHash('sha256').update(verifier).digest());
    const state = toBase64Url(randomBytes(32));
    const codePromise = this.waitForAuthCode(state);

    void shell.openExternal(
      `${AUTH_URL}?${new URLSearchParams({
        client_id: this.clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state,
        code_challenge_method: 'S256',
        code_challenge: challenge
      })}`
    );

    const code = await codePromise;
    await this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    });
  }

  /** Starts a local callback server and rejects OAuth errors or mismatched state. */
  private waitForAuthCode(expectedState: string): Promise<string> {
    const redirect = new URL(REDIRECT_URI);

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? '', REDIRECT_URI);
        if (url.pathname !== redirect.pathname) {
          res.writeHead(404).end();
          return;
        }

        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        const oauthError = url.searchParams.get('error');

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Spotify login could not be verified. Return to Flux-Star-Stream and try again.');
          server.close();
          reject(new Error('Spotify login verification failed. Please try again.'));
          return;
        }

        if (oauthError || !code) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Spotify login was cancelled. You can close this tab.');
          server.close();
          reject(new Error(oauthError === 'access_denied' ? 'Spotify login was cancelled.' : 'Spotify login failed.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<body style="font-family:sans-serif;padding:40px">Connected to Spotify. You can close this tab.</body>');
        server.close();
        resolve(code);
      });

      server.on('error', (error: NodeJS.ErrnoException) => {
        reject(
          error.code === 'EADDRINUSE'
            ? new Error(`Port ${redirect.port} is already in use. Close the app using it and try again.`)
            : error
        );
      });
      server.listen(Number(redirect.port), redirect.hostname);
    });
  }

  private async requestTokens(params: Record<string, string>): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, ...params })
    });
    const data = (await response.json()) as TokenResponse;
    if (!response.ok) throw new Error(data.error_description ?? data.error ?? 'Spotify token request failed.');

    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.tokens?.refreshToken ?? '',
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      scopes: SCOPES
    };
    writeFileSync(this.tokenFile, JSON.stringify(this.tokens), { mode: 0o600 });
    return this.tokens.accessToken;
  }

  private loadClientId(): string {
    try {
      return readFileSync(this.clientFile, 'utf8').trim();
    } catch {
      return '';
    }
  }

  private loadTokens(): Tokens | null {
    try {
      const tokens = JSON.parse(readFileSync(this.tokenFile, 'utf8')) as Tokens;
      return tokens.scopes === SCOPES ? tokens : null;
    } catch {
      return null;
    }
  }
}
