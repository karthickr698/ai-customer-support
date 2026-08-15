import type { ReturnStatus } from '@ai-customer-support/contracts';
import { InvalidReturnError } from './errors.js';
import { createReturnId, type ReturnId } from './ids.js';
import { parseOptionalDate, parseReturnStatus } from './values.js';

export type ReturnSnapshot = {
  readonly id: ReturnId;
  readonly organizationId: string;
  readonly orderId: string;
  readonly status: ReturnStatus;
  readonly reason?: string;
  readonly requestedAt: Date;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class CommerceReturn {
  private constructor(
    readonly id: ReturnId,
    readonly organizationId: string,
    readonly orderId: string,
    readonly status: ReturnStatus,
    readonly reason: string | undefined,
    readonly requestedAt: Date,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly orderId: string;
    readonly status?: string;
    readonly reason?: string;
    readonly requestedAt?: string | Date;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: ReturnId;
  }): CommerceReturn {
    if (!input.organizationId.trim()) {
      throw new InvalidReturnError('Organization is required');
    }
    if (!input.orderId.trim()) {
      throw new InvalidReturnError('Order is required');
    }
    const reason = input.reason?.trim();
    if (reason && reason.length > 1_000) {
      throw new InvalidReturnError('Reason must be at most 1000 characters');
    }
    return new CommerceReturn(
      input.id ?? createReturnId(),
      input.organizationId,
      input.orderId,
      parseReturnStatus(input.status),
      reason || undefined,
      parseOptionalDate(input.requestedAt, 'requestedAt') ?? input.now,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: ReturnSnapshot): CommerceReturn {
    return new CommerceReturn(
      snapshot.id,
      snapshot.organizationId,
      snapshot.orderId,
      snapshot.status,
      snapshot.reason,
      snapshot.requestedAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): ReturnSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      orderId: this.orderId,
      status: this.status,
      reason: this.reason,
      requestedAt: this.requestedAt,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
