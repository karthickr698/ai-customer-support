import type { PlatformRole } from '@ai-customer-support/contracts';
import { InvalidPlatformError } from './errors.js';
import { createPlatformOperatorId, type PlatformOperatorId } from './ids.js';
import { requireUuid } from './values.js';

export type PlatformOperatorStatus = 'active' | 'revoked';

export type PlatformOperatorSnapshot = {
  readonly id: PlatformOperatorId;
  readonly userId: string;
  readonly role: PlatformRole;
  readonly status: PlatformOperatorStatus;
  readonly grantedByUserId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revokedAt?: Date;
};

export class PlatformOperator {
  private constructor(
    readonly id: PlatformOperatorId,
    readonly userId: string,
    private roleValue: PlatformRole,
    private statusValue: PlatformOperatorStatus,
    readonly grantedByUserId: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private revokedAtValue: Date | undefined,
  ) {}

  static grant(input: {
    readonly userId: string;
    readonly role: PlatformRole;
    readonly now: Date;
    readonly grantedByUserId?: string;
    readonly id?: PlatformOperatorId;
  }): PlatformOperator {
    return new PlatformOperator(
      input.id ?? createPlatformOperatorId(),
      requireUuid(input.userId, 'userId'),
      input.role,
      'active',
      input.grantedByUserId,
      input.now,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: PlatformOperatorSnapshot): PlatformOperator {
    return new PlatformOperator(
      snapshot.id,
      snapshot.userId,
      snapshot.role,
      snapshot.status,
      snapshot.grantedByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.revokedAt,
    );
  }

  get role(): PlatformRole {
    return this.roleValue;
  }

  get status(): PlatformOperatorStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get revokedAt(): Date | undefined {
    return this.revokedAtValue;
  }

  get isActive(): boolean {
    return this.statusValue === 'active';
  }

  assertActive(): void {
    if (!this.isActive) {
      throw new InvalidPlatformError('Platform operator access has been revoked');
    }
  }

  changeRole(role: PlatformRole, now: Date): void {
    this.assertActive();
    this.roleValue = role;
    this.updatedAtValue = now;
  }

  revoke(now: Date): void {
    this.assertActive();
    this.statusValue = 'revoked';
    this.revokedAtValue = now;
    this.updatedAtValue = now;
  }

  reinstate(role: PlatformRole, now: Date): void {
    this.roleValue = role;
    this.statusValue = 'active';
    this.revokedAtValue = undefined;
    this.updatedAtValue = now;
  }

  toSnapshot(): PlatformOperatorSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      role: this.roleValue,
      status: this.statusValue,
      grantedByUserId: this.grantedByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
      revokedAt: this.revokedAtValue,
    };
  }
}

export function parseOperatorStatus(value: string): PlatformOperatorStatus {
  if (value === 'active' || value === 'revoked') {
    return value;
  }
  throw new InvalidPlatformError('Operator status must be active or revoked');
}
