import type { OrganizationPermission } from '@ai-customer-support/contracts';
import { InvalidOAuthGrantError } from './errors.js';
import {
  createOAuthGrantId,
  type OAuthApplicationId,
  type OAuthGrantId,
} from './ids.js';

export type OrganizationOAuthGrantSnapshot = {
  readonly id: OAuthGrantId;
  readonly organizationId: string;
  readonly applicationId: OAuthApplicationId;
  readonly userId: string;
  readonly codeHash?: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
  readonly scopes: readonly OrganizationPermission[];
  readonly accessTokenHash?: string;
  readonly refreshTokenHash?: string;
  readonly accessExpiresAt?: Date;
  readonly refreshExpiresAt?: Date;
  readonly createdAt: Date;
  readonly consumedAt?: Date;
  readonly revokedAt?: Date;
};

export class OrganizationOAuthGrant {
  private constructor(
    readonly id: OAuthGrantId,
    readonly organizationId: string,
    readonly applicationId: OAuthApplicationId,
    readonly userId: string,
    readonly codeHash: string | undefined,
    readonly codeChallenge: string,
    readonly redirectUri: string,
    readonly scopes: readonly OrganizationPermission[],
    readonly accessTokenHash: string | undefined,
    readonly refreshTokenHash: string | undefined,
    readonly accessExpiresAt: Date | undefined,
    readonly refreshExpiresAt: Date | undefined,
    readonly createdAt: Date,
    readonly consumedAt: Date | undefined,
    readonly revokedAt: Date | undefined,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly applicationId: OAuthApplicationId;
    readonly userId: string;
    readonly codeHash: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
    readonly scopes: readonly OrganizationPermission[];
    readonly now: Date;
    readonly id?: OAuthGrantId;
  }): OrganizationOAuthGrant {
    if (input.codeChallenge.trim().length < 16) {
      throw new InvalidOAuthGrantError('PKCE code challenge is required');
    }
    return new OrganizationOAuthGrant(
      input.id ?? createOAuthGrantId(),
      input.organizationId,
      input.applicationId,
      input.userId,
      input.codeHash,
      input.codeChallenge,
      input.redirectUri,
      input.scopes,
      undefined,
      undefined,
      undefined,
      undefined,
      input.now,
      undefined,
      undefined,
    );
  }

  static reconstitute(snapshot: OrganizationOAuthGrantSnapshot): OrganizationOAuthGrant {
    return new OrganizationOAuthGrant(
      snapshot.id,
      snapshot.organizationId,
      snapshot.applicationId,
      snapshot.userId,
      snapshot.codeHash,
      snapshot.codeChallenge,
      snapshot.redirectUri,
      snapshot.scopes,
      snapshot.accessTokenHash,
      snapshot.refreshTokenHash,
      snapshot.accessExpiresAt,
      snapshot.refreshExpiresAt,
      snapshot.createdAt,
      snapshot.consumedAt,
      snapshot.revokedAt,
    );
  }

  isCodeRedeemable(now: Date, ttlSeconds: number): boolean {
    if (this.revokedAt || this.consumedAt || !this.codeHash) {
      return false;
    }
    return this.createdAt.getTime() + ttlSeconds * 1000 > now.getTime();
  }

  matchesPkce(challenge: string): boolean {
    return this.codeChallenge === challenge;
  }

  issueTokens(input: {
    readonly accessTokenHash: string;
    readonly refreshTokenHash: string;
    readonly accessExpiresAt: Date;
    readonly refreshExpiresAt: Date;
    readonly now: Date;
  }): OrganizationOAuthGrant {
    return new OrganizationOAuthGrant(
      this.id,
      this.organizationId,
      this.applicationId,
      this.userId,
      this.codeHash,
      this.codeChallenge,
      this.redirectUri,
      this.scopes,
      input.accessTokenHash,
      input.refreshTokenHash,
      input.accessExpiresAt,
      input.refreshExpiresAt,
      this.createdAt,
      input.now,
      undefined,
    );
  }

  rotateTokens(input: {
    readonly accessTokenHash: string;
    readonly refreshTokenHash: string;
    readonly accessExpiresAt: Date;
    readonly refreshExpiresAt: Date;
  }): OrganizationOAuthGrant {
    if (this.revokedAt || !this.refreshTokenHash) {
      throw new InvalidOAuthGrantError();
    }
    return new OrganizationOAuthGrant(
      this.id,
      this.organizationId,
      this.applicationId,
      this.userId,
      this.codeHash,
      this.codeChallenge,
      this.redirectUri,
      this.scopes,
      input.accessTokenHash,
      input.refreshTokenHash,
      input.accessExpiresAt,
      input.refreshExpiresAt,
      this.createdAt,
      this.consumedAt,
      undefined,
    );
  }

  isAccessTokenValid(now: Date): boolean {
    if (this.revokedAt || !this.accessTokenHash || !this.accessExpiresAt) {
      return false;
    }
    return this.accessExpiresAt.getTime() > now.getTime();
  }

  isRefreshTokenValid(now: Date): boolean {
    if (this.revokedAt || !this.refreshTokenHash || !this.refreshExpiresAt) {
      return false;
    }
    return this.refreshExpiresAt.getTime() > now.getTime();
  }

  revoke(now: Date): OrganizationOAuthGrant {
    if (this.revokedAt) {
      return this;
    }
    return new OrganizationOAuthGrant(
      this.id,
      this.organizationId,
      this.applicationId,
      this.userId,
      this.codeHash,
      this.codeChallenge,
      this.redirectUri,
      this.scopes,
      this.accessTokenHash,
      this.refreshTokenHash,
      this.accessExpiresAt,
      this.refreshExpiresAt,
      this.createdAt,
      this.consumedAt,
      now,
    );
  }

  toSnapshot(): OrganizationOAuthGrantSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      applicationId: this.applicationId,
      userId: this.userId,
      codeHash: this.codeHash,
      codeChallenge: this.codeChallenge,
      redirectUri: this.redirectUri,
      scopes: this.scopes,
      accessTokenHash: this.accessTokenHash,
      refreshTokenHash: this.refreshTokenHash,
      accessExpiresAt: this.accessExpiresAt,
      refreshExpiresAt: this.refreshExpiresAt,
      createdAt: this.createdAt,
      consumedAt: this.consumedAt,
      revokedAt: this.revokedAt,
    };
  }
}
