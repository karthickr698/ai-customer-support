import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { OrganizationId } from '../../domain/organization-id.js';

export type OrganizationAuditLogRecord = {
  readonly tenantId: OrganizationId;
  readonly actorId?: string;
  readonly action: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
};

export type OrganizationAuditLogEntry = {
  readonly id: string;
  readonly tenantId: OrganizationId;
  readonly actorId: string | undefined;
  readonly action: string;
  readonly metadata: Record<string, unknown> | undefined;
  readonly occurredAt: Date;
};

export interface OrganizationAuditLogPort {
  record(entry: OrganizationAuditLogRecord): Promise<void>;
  list(tenantId: OrganizationId, page: PageRequest): Promise<Page<OrganizationAuditLogEntry>>;
}
