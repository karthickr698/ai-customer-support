import type { UserId } from './user-id.js';

export const GOOGLE_OAUTH_PROVIDER = 'google';

export type OAuthAccountSnapshot = {
  readonly id: string;
  readonly userId: UserId;
  readonly provider: typeof GOOGLE_OAUTH_PROVIDER;
  readonly providerAccountId: string;
  readonly createdAt: Date;
};

export class OAuthAccount {
  private constructor(
    readonly id: string,
    readonly userId: UserId,
    readonly provider: typeof GOOGLE_OAUTH_PROVIDER,
    readonly providerAccountId: string,
    readonly createdAt: Date,
  ) {}

  static linkGoogle(input: {
    readonly userId: UserId;
    readonly providerAccountId: string;
    readonly now: Date;
    readonly id?: string;
  }): OAuthAccount {
    return new OAuthAccount(
      input.id ?? crypto.randomUUID(),
      input.userId,
      GOOGLE_OAUTH_PROVIDER,
      input.providerAccountId,
      input.now,
    );
  }

  static reconstitute(snapshot: OAuthAccountSnapshot): OAuthAccount {
    return new OAuthAccount(
      snapshot.id,
      snapshot.userId,
      snapshot.provider,
      snapshot.providerAccountId,
      snapshot.createdAt,
    );
  }

  toSnapshot(): OAuthAccountSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      provider: this.provider,
      providerAccountId: this.providerAccountId,
      createdAt: this.createdAt,
    };
  }
}
