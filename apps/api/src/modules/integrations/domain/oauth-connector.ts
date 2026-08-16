import {
  OAUTH_CONNECTOR_PROVIDERS,
  OAUTH_CONNECTOR_STATUSES,
  type OAuthConnectorProvider,
  type OAuthConnectorStatus,
} from '@ai-customer-support/contracts';
import { InvalidOAuthConnectorError } from './errors.js';
import { createOAuthConnectorId, type OAuthConnectorId } from './ids.js';
import type { EncryptedSecret } from './integration-credential.js';
import { assertSafeHttpsUrl } from './outbound-url.js';

const MAX_NAME = 120;
const MAX_CLIENT_ID = 200;
const MAX_SCOPES = 20;

export type OAuthConnectorSnapshot = {
  readonly id: OAuthConnectorId;
  readonly organizationId: string;
  readonly provider: OAuthConnectorProvider;
  readonly name: string;
  readonly status: OAuthConnectorStatus;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: EncryptedSecret;
  readonly scopes: readonly string[];
  readonly accessToken?: EncryptedSecret;
  readonly refreshToken?: EncryptedSecret;
  readonly tokenExpiresAt?: Date;
  readonly externalAccountId?: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly disconnectedAt?: Date;
};

export class OAuthConnector {
  private constructor(
    readonly id: OAuthConnectorId,
    readonly organizationId: string,
    readonly provider: OAuthConnectorProvider,
    readonly name: string,
    readonly status: OAuthConnectorStatus,
    readonly authorizationUrl: string,
    readonly tokenUrl: string,
    readonly clientId: string,
    readonly clientSecret: EncryptedSecret,
    readonly scopes: readonly string[],
    readonly accessToken: EncryptedSecret | undefined,
    readonly refreshToken: EncryptedSecret | undefined,
    readonly tokenExpiresAt: Date | undefined,
    readonly externalAccountId: string | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly disconnectedAt: Date | undefined,
  ) {}

  get isConnected(): boolean {
    return this.status === 'connected' && Boolean(this.accessToken);
  }

  static create(input: {
    readonly organizationId: string;
    readonly provider: string;
    readonly name: string;
    readonly clientId: string;
    readonly clientSecret: EncryptedSecret;
    readonly authorizationUrl: string;
    readonly tokenUrl: string;
    readonly scopes?: readonly string[];
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: OAuthConnectorId;
  }): OAuthConnector {
    return new OAuthConnector(
      input.id ?? createOAuthConnectorId(),
      input.organizationId,
      parseProvider(input.provider),
      normalizeName(input.name),
      'pending',
      assertSafeHttpsUrl(input.authorizationUrl, 'Authorization URL'),
      assertSafeHttpsUrl(input.tokenUrl, 'Token URL'),
      normalizeClientId(input.clientId),
      input.clientSecret,
      normalizeScopes(input.scopes),
      undefined,
      undefined,
      undefined,
      undefined,
      input.createdByUserId,
      input.now,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: OAuthConnectorSnapshot): OAuthConnector {
    return new OAuthConnector(
      snapshot.id,
      snapshot.organizationId,
      snapshot.provider,
      snapshot.name,
      snapshot.status,
      snapshot.authorizationUrl,
      snapshot.tokenUrl,
      snapshot.clientId,
      snapshot.clientSecret,
      snapshot.scopes,
      snapshot.accessToken,
      snapshot.refreshToken,
      snapshot.tokenExpiresAt,
      snapshot.externalAccountId,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.disconnectedAt,
    );
  }

  replaceConfig(input: {
    readonly name?: string;
    readonly clientId?: string;
    readonly clientSecret?: EncryptedSecret;
    readonly authorizationUrl?: string;
    readonly tokenUrl?: string;
    readonly scopes?: readonly string[];
    readonly now: Date;
  }): OAuthConnector {
    return new OAuthConnector(
      this.id,
      this.organizationId,
      this.provider,
      input.name !== undefined ? normalizeName(input.name) : this.name,
      this.disconnectedAt ? 'disconnected' : 'pending',
      input.authorizationUrl !== undefined
        ? assertSafeHttpsUrl(input.authorizationUrl, 'Authorization URL')
        : this.authorizationUrl,
      input.tokenUrl !== undefined ? assertSafeHttpsUrl(input.tokenUrl, 'Token URL') : this.tokenUrl,
      input.clientId !== undefined ? normalizeClientId(input.clientId) : this.clientId,
      input.clientSecret ?? this.clientSecret,
      input.scopes !== undefined ? normalizeScopes(input.scopes) : this.scopes,
      undefined,
      undefined,
      undefined,
      undefined,
      this.createdByUserId,
      this.createdAt,
      input.now,
      undefined,
    );
  }

  connect(input: {
    readonly accessToken: EncryptedSecret;
    readonly refreshToken?: EncryptedSecret;
    readonly tokenExpiresAt?: Date;
    readonly externalAccountId?: string;
    readonly now: Date;
  }): OAuthConnector {
    return new OAuthConnector(
      this.id,
      this.organizationId,
      this.provider,
      this.name,
      'connected',
      this.authorizationUrl,
      this.tokenUrl,
      this.clientId,
      this.clientSecret,
      this.scopes,
      input.accessToken,
      input.refreshToken,
      input.tokenExpiresAt,
      input.externalAccountId,
      this.createdByUserId,
      this.createdAt,
      input.now,
      undefined,
    );
  }

  markExpired(now: Date): OAuthConnector {
    if (this.status !== 'connected') {
      return this;
    }
    return new OAuthConnector(
      this.id,
      this.organizationId,
      this.provider,
      this.name,
      'expired',
      this.authorizationUrl,
      this.tokenUrl,
      this.clientId,
      this.clientSecret,
      this.scopes,
      this.accessToken,
      this.refreshToken,
      this.tokenExpiresAt,
      this.externalAccountId,
      this.createdByUserId,
      this.createdAt,
      now,
      undefined,
    );
  }

  updateScopes(scopes: readonly string[], now: Date): OAuthConnector {
    return new OAuthConnector(
      this.id,
      this.organizationId,
      this.provider,
      this.name,
      this.status,
      this.authorizationUrl,
      this.tokenUrl,
      this.clientId,
      this.clientSecret,
      normalizeScopes(scopes),
      this.accessToken,
      this.refreshToken,
      this.tokenExpiresAt,
      this.externalAccountId,
      this.createdByUserId,
      this.createdAt,
      now,
      this.disconnectedAt,
    );
  }

  disconnect(now: Date): OAuthConnector {
    return new OAuthConnector(
      this.id,
      this.organizationId,
      this.provider,
      this.name,
      'disconnected',
      this.authorizationUrl,
      this.tokenUrl,
      this.clientId,
      this.clientSecret,
      this.scopes,
      undefined,
      undefined,
      undefined,
      this.externalAccountId,
      this.createdByUserId,
      this.createdAt,
      now,
      now,
    );
  }

  accessTokenExpired(now: Date): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    return this.tokenExpiresAt.getTime() <= now.getTime() + 30_000;
  }

  authorizationUrlWith(params: {
    readonly state: string;
    readonly redirectUri: string;
    readonly codeChallenge: string;
  }): string {
    const url = new URL(this.authorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (this.scopes.length > 0) {
      url.searchParams.set('scope', this.scopes.join(' '));
    }
    return url.toString();
  }

  toSnapshot(): OAuthConnectorSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      provider: this.provider,
      name: this.name,
      status: this.status,
      authorizationUrl: this.authorizationUrl,
      tokenUrl: this.tokenUrl,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      scopes: this.scopes,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenExpiresAt: this.tokenExpiresAt,
      externalAccountId: this.externalAccountId,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      disconnectedAt: this.disconnectedAt,
    };
  }
}

export function parseOAuthProvider(value: string): OAuthConnectorProvider {
  return parseProvider(value);
}

export function parseOAuthStatus(value: string): OAuthConnectorStatus {
  if (!(OAUTH_CONNECTOR_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidOAuthConnectorError('Invalid OAuth connector status');
  }
  return value as OAuthConnectorStatus;
}

function parseProvider(value: string): OAuthConnectorProvider {
  if (!(OAUTH_CONNECTOR_PROVIDERS as readonly string[]).includes(value)) {
    throw new InvalidOAuthConnectorError('Unsupported OAuth provider');
  }
  return value as OAuthConnectorProvider;
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw new InvalidOAuthConnectorError(`Name must be between 1 and ${MAX_NAME} characters`);
  }
  return name;
}

function normalizeClientId(raw: string): string {
  const clientId = raw.trim();
  if (clientId.length < 1 || clientId.length > MAX_CLIENT_ID) {
    throw new InvalidOAuthConnectorError('Client id is required');
  }
  return clientId;
}

function normalizeScopes(raw: readonly string[] | undefined): readonly string[] {
  const scopes = (raw ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
  if (scopes.length > MAX_SCOPES) {
    throw new InvalidOAuthConnectorError(`At most ${MAX_SCOPES} scopes are allowed`);
  }
  return scopes;
}
