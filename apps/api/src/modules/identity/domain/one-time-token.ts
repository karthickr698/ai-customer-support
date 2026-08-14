import type { UserId } from './user-id.js';

export type OneTimeTokenPurpose = 'email_verification' | 'password_reset';

export type OneTimeTokenSnapshot = {
  readonly id: string;
  readonly userId: UserId;
  readonly purpose: OneTimeTokenPurpose;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | undefined;
  readonly createdAt: Date;
};

export class OneTimeToken {
  private constructor(
    readonly id: string,
    readonly userId: UserId,
    readonly purpose: OneTimeTokenPurpose,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private consumedAtValue: Date | undefined,
    readonly createdAt: Date,
  ) {}

  static issue(input: {
    readonly userId: UserId;
    readonly purpose: OneTimeTokenPurpose;
    readonly tokenHash: string;
    readonly expiresAt: Date;
    readonly now: Date;
    readonly id?: string;
  }): OneTimeToken {
    return new OneTimeToken(
      input.id ?? crypto.randomUUID(),
      input.userId,
      input.purpose,
      input.tokenHash,
      input.expiresAt,
      undefined,
      input.now,
    );
  }

  static reconstitute(snapshot: OneTimeTokenSnapshot): OneTimeToken {
    return new OneTimeToken(
      snapshot.id,
      snapshot.userId,
      snapshot.purpose,
      snapshot.tokenHash,
      snapshot.expiresAt,
      snapshot.consumedAt,
      snapshot.createdAt,
    );
  }

  get consumedAt(): Date | undefined {
    return this.consumedAtValue;
  }

  isUsable(now: Date): boolean {
    return this.consumedAtValue === undefined && this.expiresAt.getTime() > now.getTime();
  }

  consume(now: Date): void {
    this.consumedAtValue = now;
  }

  toSnapshot(): OneTimeTokenSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      purpose: this.purpose,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      consumedAt: this.consumedAtValue,
      createdAt: this.createdAt,
    };
  }
}
