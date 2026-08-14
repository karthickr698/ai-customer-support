import type { UserId } from './user-id.js';

export type RefreshSessionSnapshot = {
  readonly id: string;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | undefined;
  readonly replacedById: string | undefined;
  readonly createdAt: Date;
  readonly userAgent: string | undefined;
  readonly ipAddress: string | undefined;
};

export class RefreshSession {
  private constructor(
    readonly id: string,
    readonly userId: UserId,
    readonly tokenHash: string,
    readonly familyId: string,
    readonly expiresAt: Date,
    private revokedAtValue: Date | undefined,
    private replacedByIdValue: string | undefined,
    readonly createdAt: Date,
    readonly userAgent: string | undefined,
    readonly ipAddress: string | undefined,
  ) {}

  static issue(input: {
    readonly userId: UserId;
    readonly tokenHash: string;
    readonly familyId?: string;
    readonly expiresAt: Date;
    readonly now: Date;
    readonly userAgent?: string;
    readonly ipAddress?: string;
    readonly id?: string;
  }): RefreshSession {
    return new RefreshSession(
      input.id ?? crypto.randomUUID(),
      input.userId,
      input.tokenHash,
      input.familyId ?? crypto.randomUUID(),
      input.expiresAt,
      undefined,
      undefined,
      input.now,
      input.userAgent,
      input.ipAddress,
    );
  }

  static reconstitute(snapshot: RefreshSessionSnapshot): RefreshSession {
    return new RefreshSession(
      snapshot.id,
      snapshot.userId,
      snapshot.tokenHash,
      snapshot.familyId,
      snapshot.expiresAt,
      snapshot.revokedAt,
      snapshot.replacedById,
      snapshot.createdAt,
      snapshot.userAgent,
      snapshot.ipAddress,
    );
  }

  get revokedAt(): Date | undefined {
    return this.revokedAtValue;
  }

  get replacedById(): string | undefined {
    return this.replacedByIdValue;
  }

  isRevoked(): boolean {
    return this.revokedAtValue !== undefined;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isUsable(now: Date): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  revoke(now: Date): void {
    if (this.revokedAtValue === undefined) {
      this.revokedAtValue = now;
    }
  }

  markReplaced(nextSessionId: string, now: Date): void {
    this.replacedByIdValue = nextSessionId;
    this.revoke(now);
  }

  toSnapshot(): RefreshSessionSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      tokenHash: this.tokenHash,
      familyId: this.familyId,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAtValue,
      replacedById: this.replacedByIdValue,
      createdAt: this.createdAt,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress,
    };
  }
}
