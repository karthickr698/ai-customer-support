import type { ApiKeyStatus, OrganizationPermission } from '@ai-customer-support/contracts';
import { API_KEY_TOKEN_PREFIX } from './api-version.js';
import { parseApiScopes } from './api-scopes.js';
import { InvalidApiKeyError } from './errors.js';
import { createOrganizationApiKeyId, type OrganizationApiKeyId } from './ids.js';

const MAX_NAME = 120;

export type OrganizationApiKeySnapshot = {
  readonly id: OrganizationApiKeyId;
  readonly organizationId: string;
  readonly name: string;
  readonly prefix: string;
  readonly tokenHash: string;
  readonly scopes: readonly OrganizationPermission[];
  readonly lastUsedAt?: Date;
  readonly expiresAt?: Date;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly revokedAt?: Date;
};

export class OrganizationApiKey {
  private constructor(
    readonly id: OrganizationApiKeyId,
    readonly organizationId: string,
    readonly name: string,
    readonly prefix: string,
    readonly tokenHash: string,
    readonly scopes: readonly OrganizationPermission[],
    readonly lastUsedAt: Date | undefined,
    readonly expiresAt: Date | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly revokedAt: Date | undefined,
  ) {}

  get status(): ApiKeyStatus {
    if (this.revokedAt) {
      return 'revoked';
    }
    return 'active';
  }

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly token: string;
    readonly tokenHash: string;
    readonly scopes?: readonly string[];
    readonly expiresAt?: Date;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: OrganizationApiKeyId;
  }): OrganizationApiKey {
    assertApiKeyToken(input.token);
    return new OrganizationApiKey(
      input.id ?? createOrganizationApiKeyId(),
      input.organizationId,
      normalizeName(input.name),
      displayPrefix(input.token),
      input.tokenHash,
      parseApiScopes(input.scopes),
      undefined,
      input.expiresAt,
      input.createdByUserId,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: OrganizationApiKeySnapshot): OrganizationApiKey {
    return new OrganizationApiKey(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.prefix,
      snapshot.tokenHash,
      snapshot.scopes,
      snapshot.lastUsedAt,
      snapshot.expiresAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.revokedAt,
    );
  }

  isUsable(now: Date): boolean {
    if (this.revokedAt) {
      return false;
    }
    if (this.expiresAt && this.expiresAt.getTime() <= now.getTime()) {
      return false;
    }
    return true;
  }

  markUsed(now: Date): OrganizationApiKey {
    return new OrganizationApiKey(
      this.id,
      this.organizationId,
      this.name,
      this.prefix,
      this.tokenHash,
      this.scopes,
      now,
      this.expiresAt,
      this.createdByUserId,
      this.createdAt,
      this.revokedAt,
    );
  }

  revoke(now: Date): OrganizationApiKey {
    if (this.revokedAt) {
      return this;
    }
    return new OrganizationApiKey(
      this.id,
      this.organizationId,
      this.name,
      this.prefix,
      this.tokenHash,
      this.scopes,
      this.lastUsedAt,
      this.expiresAt,
      this.createdByUserId,
      this.createdAt,
      now,
    );
  }

  toSnapshot(): OrganizationApiKeySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.name,
      prefix: this.prefix,
      tokenHash: this.tokenHash,
      scopes: this.scopes,
      lastUsedAt: this.lastUsedAt,
      expiresAt: this.expiresAt,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      revokedAt: this.revokedAt,
    };
  }
}

export function assertApiKeyToken(token: string): string {
  if (!token.startsWith(API_KEY_TOKEN_PREFIX) || token.length < API_KEY_TOKEN_PREFIX.length + 16) {
    throw new InvalidApiKeyError('API key token is invalid');
  }
  return token;
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw new InvalidApiKeyError(`Name must be between 1 and ${MAX_NAME} characters`);
  }
  return name;
}

function displayPrefix(token: string): string {
  return token.slice(0, 12);
}
