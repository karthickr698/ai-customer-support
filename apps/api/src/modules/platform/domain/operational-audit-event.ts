import type { PlatformAuditOutcome } from '@ai-customer-support/contracts';
import { InvalidPlatformError } from './errors.js';
import { createOperationalAuditEventId, type OperationalAuditEventId } from './ids.js';
import { parseAuditAction, parseAuditOutcome, redactMetadata } from './values.js';

export type OperationalAuditEventSnapshot = {
  readonly id: OperationalAuditEventId;
  readonly actorId?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: PlatformAuditOutcome;
  readonly organizationId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
};

export class OperationalAuditEvent {
  private constructor(
    readonly id: OperationalAuditEventId,
    readonly actorId: string | undefined,
    readonly action: string,
    readonly resourceType: string,
    readonly resourceId: string | undefined,
    readonly outcome: PlatformAuditOutcome,
    readonly organizationId: string | undefined,
    readonly metadata: Record<string, unknown> | undefined,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
    readonly occurredAt: Date,
  ) {}

  static create(input: {
    readonly action: string;
    readonly resourceType: string;
    readonly outcome: string;
    readonly occurredAt: Date;
    readonly actorId?: string;
    readonly resourceId?: string;
    readonly organizationId?: string;
    readonly metadata?: Record<string, unknown>;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
    readonly id?: OperationalAuditEventId;
  }): OperationalAuditEvent {
    const resourceType = input.resourceType.trim();
    if (resourceType.length < 1 || resourceType.length > 80) {
      throw new InvalidPlatformError('resourceType must be between 1 and 80 characters');
    }
    return new OperationalAuditEvent(
      input.id ?? createOperationalAuditEventId(),
      input.actorId,
      parseAuditAction(input.action),
      resourceType,
      input.resourceId,
      parseAuditOutcome(input.outcome),
      input.organizationId,
      redactMetadata(input.metadata),
      input.ipAddress,
      input.userAgent?.slice(0, 512),
      input.requestId,
      input.occurredAt,
    );
  }

  static reconstitute(snapshot: OperationalAuditEventSnapshot): OperationalAuditEvent {
    return new OperationalAuditEvent(
      snapshot.id,
      snapshot.actorId,
      snapshot.action,
      snapshot.resourceType,
      snapshot.resourceId,
      snapshot.outcome,
      snapshot.organizationId,
      snapshot.metadata,
      snapshot.ipAddress,
      snapshot.userAgent,
      snapshot.requestId,
      snapshot.occurredAt,
    );
  }

  toSnapshot(): OperationalAuditEventSnapshot {
    return {
      id: this.id,
      actorId: this.actorId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      outcome: this.outcome,
      organizationId: this.organizationId,
      metadata: this.metadata,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      requestId: this.requestId,
      occurredAt: this.occurredAt,
    };
  }
}
