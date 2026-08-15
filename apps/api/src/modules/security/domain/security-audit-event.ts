import type { SecurityAuditOutcome } from '@ai-customer-support/contracts';
import { InvalidSecurityError } from './errors.js';
import { createSecurityAuditEventId, type SecurityAuditEventId } from './ids.js';
import { parseAuditAction, parseAuditOutcome, redactMetadata } from './values.js';

export type SecurityAuditEventSnapshot = {
  readonly id: SecurityAuditEventId;
  readonly organizationId: string;
  readonly actorId?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: SecurityAuditOutcome;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
};

export class SecurityAuditEvent {
  private constructor(
    readonly id: SecurityAuditEventId,
    readonly organizationId: string,
    readonly actorId: string | undefined,
    readonly action: string,
    readonly resourceType: string,
    readonly resourceId: string | undefined,
    readonly outcome: SecurityAuditOutcome,
    readonly metadata: Record<string, unknown> | undefined,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
    readonly occurredAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly action: string;
    readonly resourceType: string;
    readonly outcome: string;
    readonly occurredAt: Date;
    readonly actorId?: string;
    readonly resourceId?: string;
    readonly metadata?: Record<string, unknown>;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
    readonly id?: SecurityAuditEventId;
  }): SecurityAuditEvent {
    if (!input.organizationId.trim()) {
      throw new InvalidSecurityError('Organization is required');
    }
    const resourceType = input.resourceType.trim();
    if (resourceType.length < 1 || resourceType.length > 80) {
      throw new InvalidSecurityError('resourceType must be between 1 and 80 characters');
    }
    return new SecurityAuditEvent(
      input.id ?? createSecurityAuditEventId(),
      input.organizationId,
      input.actorId,
      parseAuditAction(input.action),
      resourceType,
      input.resourceId,
      parseAuditOutcome(input.outcome),
      redactMetadata(input.metadata),
      input.ipAddress,
      input.userAgent?.slice(0, 512),
      input.requestId,
      input.occurredAt,
    );
  }

  static reconstitute(snapshot: SecurityAuditEventSnapshot): SecurityAuditEvent {
    return new SecurityAuditEvent(
      snapshot.id,
      snapshot.organizationId,
      snapshot.actorId,
      snapshot.action,
      snapshot.resourceType,
      snapshot.resourceId,
      snapshot.outcome,
      snapshot.metadata,
      snapshot.ipAddress,
      snapshot.userAgent,
      snapshot.requestId,
      snapshot.occurredAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): SecurityAuditEventSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      actorId: this.actorId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      outcome: this.outcome,
      metadata: this.metadata,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      requestId: this.requestId,
      occurredAt: this.occurredAt,
    };
  }
}
