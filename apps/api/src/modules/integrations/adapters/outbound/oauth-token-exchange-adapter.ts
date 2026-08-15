import { OAuthConnectorFailedError } from '../../domain/errors.js';
import { assertSafeHttpsUrl } from '../../domain/outbound-url.js';
import type { OAuthTokenExchangePort, OAuthTokenSet } from '../../application/ports.js';

export class FetchOAuthTokenExchangeAdapter implements OAuthTokenExchangePort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async exchangeAuthorizationCode(input: {
    readonly tokenUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<OAuthTokenSet> {
    return this.tokenRequest(input.tokenUrl, {
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    });
  }

  async refreshAccessToken(input: {
    readonly tokenUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly refreshToken: string;
  }): Promise<OAuthTokenSet> {
    return this.tokenRequest(input.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
    });
  }

  private async tokenRequest(
    tokenUrl: string,
    body: Record<string, string>,
  ): Promise<OAuthTokenSet> {
    const url = assertSafeHttpsUrl(tokenUrl, 'Token URL');
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new OAuthConnectorFailedError();
    }

    if (!response.ok) {
      throw new OAuthConnectorFailedError();
    }

    const parsed: unknown = await response.json().catch(() => null);
    const tokens = readTokenSet(parsed);
    if (!tokens) {
      throw new OAuthConnectorFailedError();
    }
    return tokens;
  }
}

function readTokenSet(value: unknown): OAuthTokenSet | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const accessToken = typeof record.access_token === 'string' ? record.access_token : undefined;
  if (!accessToken) {
    return undefined;
  }
  const refreshToken = typeof record.refresh_token === 'string' ? record.refresh_token : undefined;
  const expiresIn =
    typeof record.expires_in === 'number'
      ? record.expires_in
      : typeof record.expires_in === 'string'
        ? Number(record.expires_in)
        : undefined;
  const externalAccountId =
    typeof record.account_id === 'string'
      ? record.account_id
      : typeof record.user_id === 'string'
        ? record.user_id
        : undefined;

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: Number.isFinite(expiresIn) ? expiresIn : undefined,
    externalAccountId,
  };
}
