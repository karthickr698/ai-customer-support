import { EmailAddress } from './email-address.js';
import { EmailNotVerifiedError, InvalidDisplayNameError, UserDisabledError } from './errors.js';
import { createUserId, type UserId } from './user-id.js';

export type UserStatus = 'active' | 'disabled';

export type UserSnapshot = {
  readonly id: UserId;
  readonly email: string;
  readonly passwordHash: string | undefined;
  readonly displayName: string;
  readonly emailVerifiedAt: Date | undefined;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class User {
  private constructor(
    readonly id: UserId,
    readonly email: EmailAddress,
    private passwordHashValue: string | undefined,
    private displayNameValue: string,
    private emailVerifiedAtValue: Date | undefined,
    private statusValue: UserStatus,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static register(input: {
    readonly email: EmailAddress;
    readonly passwordHash: string;
    readonly displayName: string;
    readonly now: Date;
    readonly id?: UserId;
  }): User {
    return new User(
      input.id ?? createUserId(),
      input.email,
      input.passwordHash,
      normalizeDisplayName(input.displayName),
      undefined,
      'active',
      input.now,
      input.now,
    );
  }

  static registerFromGoogle(input: {
    readonly email: EmailAddress;
    readonly displayName: string;
    readonly now: Date;
    readonly id?: UserId;
  }): User {
    return new User(
      input.id ?? createUserId(),
      input.email,
      undefined,
      normalizeDisplayName(input.displayName),
      input.now,
      'active',
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: UserSnapshot): User {
    return new User(
      snapshot.id,
      EmailAddress.parse(snapshot.email),
      snapshot.passwordHash,
      snapshot.displayName,
      snapshot.emailVerifiedAt,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get passwordHash(): string | undefined {
    return this.passwordHashValue;
  }

  get displayName(): string {
    return this.displayNameValue;
  }

  get emailVerifiedAt(): Date | undefined {
    return this.emailVerifiedAtValue;
  }

  get status(): UserStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get emailVerified(): boolean {
    return this.emailVerifiedAtValue !== undefined;
  }

  hasPassword(): boolean {
    return this.passwordHashValue !== undefined;
  }

  assertCanAuthenticate(): void {
    if (this.statusValue === 'disabled') {
      throw new UserDisabledError();
    }
  }

  assertEmailVerified(): void {
    if (!this.emailVerified) {
      throw new EmailNotVerifiedError();
    }
  }

  verifyEmail(now: Date): void {
    this.assertCanAuthenticate();
    this.emailVerifiedAtValue = now;
    this.updatedAtValue = now;
  }

  replacePassword(passwordHash: string, now: Date): void {
    this.assertCanAuthenticate();
    this.passwordHashValue = passwordHash;
    this.updatedAtValue = now;
  }

  disable(now: Date): void {
    this.statusValue = 'disabled';
    this.updatedAtValue = now;
  }

  toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this.email.value,
      passwordHash: this.passwordHashValue,
      displayName: this.displayNameValue,
      emailVerifiedAt: this.emailVerifiedAtValue,
      status: this.statusValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeDisplayName(raw: string): string {
  const displayName = raw.trim();

  if (displayName.length < 1 || displayName.length > 80) {
    throw new InvalidDisplayNameError();
  }

  return displayName;
}
