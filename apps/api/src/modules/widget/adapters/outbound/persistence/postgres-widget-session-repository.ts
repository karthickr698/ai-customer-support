import type { Prisma, PrismaClient } from '@prisma/client';
import type { WidgetSessionRepository } from '../../../application/ports/widget-session-repository.js';
import { WidgetSession, type WidgetSessionKind, type WidgetSessionSnapshot } from '../../../domain/widget-session.js';
import { createWidgetSessionId, type WidgetSessionId } from '../../../domain/widget-session-id.js';

type SessionRecord = {
  id: string;
  organizationId: string;
  widgetConfigurationId: string;
  visitorId: string;
  kind: string;
  email: string | null;
  name: string | null;
  customerId: string | null;
  tokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export class PostgresWidgetSessionRepository implements WidgetSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(session: WidgetSession): Promise<void> {
    const snapshot = session.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.widgetSession.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        kind: data.kind,
        email: data.email,
        name: data.name,
        customerId: data.customerId,
        lastSeenAt: data.lastSeenAt,
        revokedAt: data.revokedAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<WidgetSession | null> {
    const record = await this.prisma.widgetSession.findUnique({
      where: { tokenHash },
    });
    return record ? toSession(record) : null;
  }

  async findById(tenantId: string, sessionId: WidgetSessionId): Promise<WidgetSession | null> {
    const record = await this.prisma.widgetSession.findFirst({
      where: { id: sessionId, organizationId: tenantId },
    });
    return record ? toSession(record) : null;
  }
}

function toSession(record: SessionRecord): WidgetSession {
  const snapshot: WidgetSessionSnapshot = {
    id: createWidgetSessionId(record.id),
    organizationId: record.organizationId,
    widgetConfigurationId: record.widgetConfigurationId,
    visitorId: record.visitorId,
    kind: record.kind as WidgetSessionKind,
    email: record.email ?? undefined,
    name: record.name ?? undefined,
    customerId: record.customerId ?? undefined,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    lastSeenAt: record.lastSeenAt,
    revokedAt: record.revokedAt ?? undefined,
    createdAt: record.createdAt,
  };
  return WidgetSession.reconstitute(snapshot);
}

function toRecord(snapshot: WidgetSessionSnapshot): Prisma.WidgetSessionUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    widgetConfigurationId: snapshot.widgetConfigurationId,
    visitorId: snapshot.visitorId,
    kind: snapshot.kind,
    email: snapshot.email ?? null,
    name: snapshot.name ?? null,
    customerId: snapshot.customerId ?? null,
    tokenHash: snapshot.tokenHash,
    expiresAt: snapshot.expiresAt,
    lastSeenAt: snapshot.lastSeenAt,
    revokedAt: snapshot.revokedAt ?? null,
    createdAt: snapshot.createdAt,
  };
}
