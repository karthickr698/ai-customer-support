import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditLogPort, AuditLogRecord } from '../../../application/ports/audit-log-port.js';

export class PostgresAuditLog implements AuditLogPort {
  constructor(private readonly prisma: PrismaClient) {}

  async record(entry: AuditLogRecord): Promise<void> {
    const data: Prisma.IdentityAuditLogUncheckedCreateInput = {
      id: crypto.randomUUID(),
      actorId: entry.actorId ?? null,
      action: entry.action,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      occurredAt: entry.occurredAt,
    };

    await this.prisma.identityAuditLog.create({ data });
  }
}
