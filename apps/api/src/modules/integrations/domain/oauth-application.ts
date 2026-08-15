import type { OAuthApplicationStatus, OrganizationPermission } from '@ai-customer-support/contracts';
import { OAUTH_CLIENT_ID_PREFIX } from './api-version.js';
import { parseOAuthScopes } from './api-scopes.js';
import { InvalidOAuthApplicationError } from './errors.js';
import { createOAuthApplicationId, type OAuthApplicationId } from './ids.js';
import { assertSafeCallbackUrl } from './outbound-url.js';

const MAX_NAME = 120;
const MAX_REDIRECTS = 10;

export type OrganizationOAuthApplicationSnapshot = {
  readonly id: OAuthApplicationId;
  readonly organizationId: string;
  readonly name: string;
  readonly clientId: string;
  readonly clientSecretHash: string;
  readonly clientSecretLastFour: string;
  readonly redirectUris: readonly string[];
  readonly scopes: readonly OrganizationPermission[];
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revokedAt?: Date;
};

export class OrganizationOAuthApplication {
  private constructor(
    readonly id: OAuthApplicationId,
    readonly organizationId: string,
    readonly name: string,
    readonly clientId: string,
    readonly clientSecretHash: string,
    readonly clientSecretLastFour: string,
    readonly redirectUris: readonly string[],
    readonly scopes: readonly OrganizationPermission[],
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly revokedAt: Date | undefined,
  ) {}

  get status(): OAuthApplicationStatus {
    return this.revokedAt ? 'revoked' : 'active';
  }

  get isActive(): boolean {
    return this.status === 'active';
  }

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly clientSecretHash: string;
    readonly redirectUris: readonly string[];
    readonly scopes?: readonly string[];
    readonly createdByUserId: string;
    readonly now: Date;
    readonly allowLocalHttp?: boolean;
    readonly id?: OAuthApplicationId;
  }): OrganizationOAuthApplication {
    if (!input.clientId.startsWith(OAUTH_CLIENT_ID_PREFIX)) {
      throw new InvalidOAuthApplicationError('Client id is invalid');
    }
    return new OrganizationOAuthApplication(
      input.id ?? createOAuthApplicationId(),
      input.organizationId,
      normalizeName(input.name),
      input.clientId,
      input.clientSecretHash,
      lastFour(input.clientSecret),
      parseRedirectUris(input.redirectUris, input.allowLocalHttp),
      parseOAuthScopes(input.scopes),
      input.createdByUserId,
      input.now,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: OrganizationOAuthApplicationSnapshot): OrganizationOAuthApplication {
    return new OrganizationOAuthApplication(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.clientId,
      snapshot.clientSecretHash,
      snapshot.clientSecretLastFour,
      snapshot.redirectUris,
      snapshot.scopes,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.revokedAt,
    );
  }

  allowsRedirect(uri: string): boolean {
    return this.redirectUris.includes(uri);
  }

  verifyClientSecret(secretHash: string): boolean {
    return this.clientSecretHash === secretHash && this.isActive;
  }

  revoke(now: Date): OrganizationOAuthApplication {
    if (this.revokedAt) {
      return this;
    }
    return new OrganizationOAuthApplication(
      this.id,
      this.organizationId,
      this.name,
      this.clientId,
      this.clientSecretHash,
      this.clientSecretLastFour,
      this.redirectUris,
      this.scopes,
      this.createdByUserId,
      this.createdAt,
      now,
      now,
    );
  }

  toSnapshot(): OrganizationOAuthApplicationSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.name,
      clientId: this.clientId,
      clientSecretHash: this.clientSecretHash,
      clientSecretLastFour: this.clientSecretLastFour,
      redirectUris: this.redirectUris,
      scopes: this.scopes,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      revokedAt: this.revokedAt,
    };
  }
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw new InvalidOAuthApplicationError(`Name must be between 1 and ${MAX_NAME} characters`);
  }
  return name;
}

function parseRedirectUris(raw: readonly string[], allowLocalHttp?: boolean): readonly string[] {
  const uris = [...new Set(raw.map((item) => item.trim()).filter((item) => item.length > 0))];
  if (uris.length === 0) {
    throw new InvalidOAuthApplicationError('At least one redirect URI is required');
  }
  if (uris.length > MAX_REDIRECTS) {
    throw new InvalidOAuthApplicationError(`At most ${MAX_REDIRECTS} redirect URIs are allowed`);
  }
  return uris.map((uri) => assertSafeCallbackUrl(uri, 'Redirect URI', { allowLocalHttp }));
}

function lastFour(secret: string): string {
  return secret.slice(-4);
}
