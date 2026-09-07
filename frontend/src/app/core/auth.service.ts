import { computed, inject, Injectable, signal } from '@angular/core';
import { ConfigService } from './config.service';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';

interface StoredTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const STORAGE_KEY = 'items_app_tokens';
const PKCE_VERIFIER_KEY = 'items_app_pkce_verifier';

/**
 * Sole owner of auth/token state. Both login paths below funnel through
 * storeTokens() into the same shape, so the guard and items page are
 * indifferent to which path the user logged in with.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private config = inject(ConfigService);

  private tokens = signal<StoredTokens | null>(this.readStoredTokens());
  readonly isAuthenticated = computed(() => {
    const t = this.tokens();
    return t !== null && t.expiresAt > Date.now();
  });

  get accessToken(): string | null {
    return this.tokens()?.accessToken ?? null;
  }

  /**
   * AWS: default login path. Calls Cognito's InitiateAuth API directly over
   * HTTPS (no AWS SDK) -- USER_PASSWORD_AUTH sends the password straight to
   * Cognito's own endpoint, which then returns access/id/refresh tokens.
   */
  async loginWithPassword(email: string, password: string): Promise<void> {
    const { cognitoClientId, region } = this.config.get();

    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: cognitoClientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message ?? 'Login failed');
    }
    if (!body.AuthenticationResult) {
      throw new Error(`Unsupported login challenge: ${body.ChallengeName ?? 'unknown'}`);
    }

    const result = body.AuthenticationResult;
    this.storeTokens({
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      expiresAt: Date.now() + result.ExpiresIn * 1000,
    });
  }

  /**
   * AWS: secondary login path. Redirects to Cognito's Hosted UI
   * (<cognitoDomain>/oauth2/authorize) using Authorization Code + PKCE.
   */
  async startHostedUiLogin(): Promise<void> {
    const { cognitoDomain, cognitoClientId } = this.config.get();
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cognitoClientId,
      redirect_uri: this.redirectUri(),
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${cognitoDomain}/oauth2/authorize?${params.toString()}`;
  }

  /** AWS: exchanges the Hosted UI's authorization code at Cognito's <cognitoDomain>/oauth2/token endpoint. */
  async handleHostedUiCallback(code: string): Promise<void> {
    const { cognitoDomain, cognitoClientId } = this.config.get();
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error('Missing PKCE verifier — please restart the Hosted UI login');
    }

    const response = await fetch(`${cognitoDomain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: cognitoClientId,
        code,
        redirect_uri: this.redirectUri(),
        code_verifier: verifier,
      }).toString(),
    });

    const body = await response.json();
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    if (!response.ok) {
      throw new Error(body.error_description ?? 'Hosted UI login failed');
    }

    this.storeTokens({
      accessToken: body.access_token,
      idToken: body.id_token,
      refreshToken: body.refresh_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    });
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.tokens.set(null);
  }

  private redirectUri(): string {
    return `${window.location.origin}/callback`;
  }

  private storeTokens(tokens: StoredTokens): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    this.tokens.set(tokens);
  }

  private readStoredTokens(): StoredTokens | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  }
}
