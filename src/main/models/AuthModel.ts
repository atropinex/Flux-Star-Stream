import { app, shell } from 'electron';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { REDIRECT_URI, SCOPES } from '../../shared/spotifyConfig';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTH_URL = 'https://accounts.spotify.com/authorize';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // milliseconds since 1970
  scopes: string;    // scopes the token was granted for
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error_description?: string;
}

// Base64 without characters that are unsafe in URLs.
const toBase64Url = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Handles Spotify login (PKCE flow) and keeps the tokens on disk. */
export class AuthModel {
  private tokenFile = join(app.getPath('userData'), 'tokens.json');
  private clientFile = join(app.getPath('userData'), 'client-id.txt');
  private clientId = this.loadClientId();
  private tokens: Tokens | null = this.loadTokens();

  isConfigured(): boolean {
    return this.clientId !== '';
  }

  /** Saves the Client ID typed into the app. A different Client ID means a fresh login. */
  setClientId(clientId: string): void {
    this.clientId = clientId.trim();
    writeFileSync(this.clientFile, this.clientId);
    rmSync(this.tokenFile, { force: true });
    this.tokens = null;
  }

  hasSession(): boolean {
    return this.tokens !== null;
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
      this.tokens = null;
      return null;
    }
  }

  /** Opens the browser, waits for Spotify to redirect back, then stores the tokens. */
  async login(): Promise<void> {
    const verifier = toBase64Url(randomBytes(48));
    const challenge = toBase64Url(createHash('sha256').update(verifier).digest());

    const codePromise = this.waitForAuthCode();
    shell.openExternal(
      `${AUTH_URL}?${new URLSearchParams({
        client_id: this.clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
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

  /** Starts a tiny local server that catches the redirect from Spotify. */
  private waitForAuthCode(): Promise<string> {
    const redirect = new URL(REDIRECT_URI);

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? '', REDIRECT_URI);
        if (url.pathname !== redirect.pathname) return res.end();

        res.end('<body style="font-family:sans-serif;padding:40px">Connected. You can close this tab.</body>');
        server.close();

        const code = url.searchParams.get('code');
        code ? resolve(code) : reject(new Error('Login was cancelled.'));
      });

      server.on('error', (error: NodeJS.ErrnoException) =>
        reject(
          error.code === 'EADDRINUSE'
            ? new Error(`Port ${redirect.port} is already in use. Close whatever is using it (VS Code Live Server?) and try again.`)
            : error
        )
      );
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
    if (!response.ok) throw new Error(data.error_description ?? 'Token request failed.');

    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.tokens?.refreshToken ?? '',
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      scopes: SCOPES
    };
    writeFileSync(this.tokenFile, JSON.stringify(this.tokens));
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
      return tokens.scopes === SCOPES ? tokens : null; // new scopes need a fresh login
    } catch {
      return null;
    }
  }
}
