import { GoogleOAuthFailedError } from '../../../domain/errors.js';
import type {
  GoogleAuthorizationRequest,
  GoogleOAuthPort,
  GoogleOAuthProfile,
} from '../../../application/ports/google-oauth-port.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export class GoogleOAuthAdapter implements GoogleOAuthPort {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  createAuthorizationUrl(request: GoogleAuthorizationRequest): URL {
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', request.state);
    url.searchParams.set('code_challenge', request.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    return url;
  }

  async exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<GoogleOAuthProfile> {
    const tokenResponse = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: input.code,
        code_verifier: input.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new GoogleOAuthFailedError();
    }

    const tokenBody: unknown = await tokenResponse.json();
    const accessToken = readAccessToken(tokenBody);
    if (!accessToken) {
      throw new GoogleOAuthFailedError();
    }

    const profileResponse = await this.fetchImpl(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!profileResponse.ok) {
      throw new GoogleOAuthFailedError();
    }

    const profileBody: unknown = await profileResponse.json();
    const profile = readProfile(profileBody);
    if (!profile) {
      throw new GoogleOAuthFailedError();
    }

    return profile;
  }
}

function readAccessToken(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const token = (value as Record<string, unknown>).access_token;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

function readProfile(value: unknown): GoogleOAuthProfile | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const providerAccountId = typeof record.sub === 'string' ? record.sub : undefined;
  const email = typeof record.email === 'string' ? record.email : undefined;
  const emailVerified = record.email_verified === true || record.email_verified === 'true';
  const displayName =
    (typeof record.name === 'string' && record.name) ||
    (typeof record.given_name === 'string' && record.given_name) ||
    email;

  if (!providerAccountId || !email || !displayName) {
    return undefined;
  }

  return { providerAccountId, email, emailVerified, displayName };
}
