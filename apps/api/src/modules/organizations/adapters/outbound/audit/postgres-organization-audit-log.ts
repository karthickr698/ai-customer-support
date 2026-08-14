import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createOrganizationId, type OrganizationId } from '../../../domain/organization-id.js';
import type {
  OrganizationAuditLogEntry,
  OrganizationAuditLogPort,
  OrganizationAuditLogRecord,
} from '../../../application/ports/organization-audit-log-port.js';

export class PostgresOrganizationAuditLog implements OrganizationAuditLogPort {
  constructor(private readonly prisma: PrismaClient) {}

  async record(entry: OrganizationAuditLogRecord): Promise<void> {
    const data: Prisma.OrganizationAuditLogUncheckedCreateInput = {
      id: crypto.randomUUID(),
      organizationId: entry.tenantId,
      actorId: entry.actorId ?? null,
      action: entry.action,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      occurredAt: entry.occurredAt,
    };

    await this.prisma.organizationAuditLog.create({ data });
  }

  async list(tenantId: OrganizationId, page: PageRequest): Promise<Page<OrganizationAuditLogEntry>> {
    const skip = (page.page - 1) * page.pageSize;
    const where = { organizationId: tenantId };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.organizationAuditLog.count({ where }),
      this.prisma.organizationAuditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);

    return {
      items: records.map((record) => ({
        id: record.id,
        tenantId: createOrganizationId(record.organizationId),
        actorId: record.actorId ?? undefined,
        action: record.action,
        metadata: isJsonObject(record.metadata) ? record.metadata : undefined,
        occurredAt: record.occurredAt,
      })),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
