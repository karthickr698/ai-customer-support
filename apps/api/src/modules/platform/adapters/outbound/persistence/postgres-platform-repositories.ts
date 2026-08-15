import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  FeatureFlagOverrideRepository,
  FeatureFlagRepository,
  OperationalAuditListFilter,
  OperationalAuditRepository,
  PlatformOperatorRepository,
} from '../../../application/ports.js';
import { FeatureFlag, type FeatureFlagSnapshot } from '../../../domain/feature-flag.js';
import {
  FeatureFlagOverride,
  type FeatureFlagOverrideSnapshot,
} from '../../../domain/feature-flag-override.js';
import {
  createFeatureFlagId,
  createFeatureFlagOverrideId,
  createOperationalAuditEventId,
  createPlatformOperatorId,
  type FeatureFlagId,
  type OperationalAuditEventId,
  type PlatformOperatorId,
} from '../../../domain/ids.js';
import {
  OperationalAuditEvent,
  type OperationalAuditEventSnapshot,
} from '../../../domain/operational-audit-event.js';
import { parseOperatorStatus, PlatformOperator, type PlatformOperatorSnapshot } from '../../../domain/platform-operator.js';
import { jsonRecord, parseAuditOutcome, parsePlatformRole } from '../../../domain/values.js';

export class PostgresPlatformOperatorRepository implements PlatformOperatorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(operator: PlatformOperator): Promise<void> {
    const snapshot = operator.toSnapshot();
    const data = toOperatorRecord(snapshot);
    await this.prisma.platformOperator.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        role: data.role,
        status: data.status,
        updatedAt: data.updatedAt,
        revokedAt: data.revokedAt,
      },
    });
  }

  async findById(id: PlatformOperatorId): Promise<PlatformOperator | null> {
    const record = await this.prisma.platformOperator.findUnique({ where: { id } });
    return record ? toOperator(record) : null;
  }

  async findByUserId(userId: string): Promise<PlatformOperator | null> {
    const record = await this.prisma.platformOperator.findUnique({ where: { userId } });
    return record ? toOperator(record) : null;
  }

  async list(includeRevoked = false): Promise<PlatformOperator[]> {
    const records = await this.prisma.platformOperator.findMany({
      where: includeRevoked ? undefined : { status: 'active' },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(toOperator);
  }

  async countActiveOwners(): Promise<number> {
    return this.prisma.platformOperator.count({ where: { status: 'active', role: 'owner' } });
  }

  async countActive(): Promise<number> {
    return this.prisma.platformOperator.count({ where: { status: 'active' } });
  }
}

export class PostgresFeatureFlagRepository implements FeatureFlagRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(flag: FeatureFlag): Promise<void> {
    const snapshot = flag.toSnapshot();
    const data = toFlagRecord(snapshot);
    await this.prisma.platformFeatureFlag.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        description: data.description,
        enabled: data.enabled,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(flagId: FeatureFlagId): Promise<void> {
    await this.prisma.platformFeatureFlag.deleteMany({ where: { id: flagId } });
  }

  async findById(flagId: FeatureFlagId): Promise<FeatureFlag | null> {
    const record = await this.prisma.platformFeatureFlag.findUnique({ where: { id: flagId } });
    return record ? toFlag(record) : null;
  }

  async findByKey(key: string): Promise<FeatureFlag | null> {
    const record = await this.prisma.platformFeatureFlag.findUnique({ where: { key } });
    return record ? toFlag(record) : null;
  }

  async list(): Promise<FeatureFlag[]> {
    const records = await this.prisma.platformFeatureFlag.findMany({ orderBy: { key: 'asc' } });
    return records.map(toFlag);
  }
}

export class PostgresFeatureFlagOverrideRepository implements FeatureFlagOverrideRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(override: FeatureFlagOverride): Promise<void> {
    const snapshot = override.toSnapshot();
    const data = toOverrideRecord(snapshot);
    await this.prisma.platformFeatureFlagOverride.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        enabled: data.enabled,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(flagId: FeatureFlagId, organizationId: string): Promise<void> {
    await this.prisma.platformFeatureFlagOverride.deleteMany({
      where: { flagId, organizationId },
    });
  }

  async findByFlagAndTenant(
    flagId: FeatureFlagId,
    organizationId: string,
  ): Promise<FeatureFlagOverride | null> {
    const record = await this.prisma.platformFeatureFlagOverride.findUnique({
      where: { flagId_organizationId: { flagId, organizationId } },
    });
    return record ? toOverride(record) : null;
  }

  async listByFlag(flagId: FeatureFlagId): Promise<FeatureFlagOverride[]> {
    const records = await this.prisma.platformFeatureFlagOverride.findMany({
      where: { flagId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toOverride);
  }

  async deleteByFlag(flagId: FeatureFlagId): Promise<void> {
    await this.prisma.platformFeatureFlagOverride.deleteMany({ where: { flagId } });
  }
}

export class PostgresOperationalAuditRepository implements OperationalAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(event: OperationalAuditEvent): Promise<void> {
    const snapshot = event.toSnapshot();
    await this.prisma.platformOperationalAuditLog.create({ data: toAuditRecord(snapshot) });
  }

  async findById(eventId: OperationalAuditEventId): Promise<OperationalAuditEvent | null> {
    const record = await this.prisma.platformOperationalAuditLog.findUnique({ where: { id: eventId } });
    return record ? toAuditEvent(record) : null;
  }

  async list(
    page: PageRequest,
    filter?: OperationalAuditListFilter,
  ): Promise<Page<OperationalAuditEvent>> {
    const where = toAuditWhere(filter);
    const skip = (page.page - 1) * page.pageSize;
    const [total, records] = await this.prisma.$transaction([
      this.prisma.platformOperationalAuditLog.count({ where }),
      this.prisma.platformOperationalAuditLog.findMany({
        where,
        skip,
        take: page.pageSize,
        orderBy: { occurredAt: 'desc' },
      }),
    ]);
    return {
      items: records.map(toAuditEvent),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

function toOperatorRecord(snapshot: PlatformOperatorSnapshot): Prisma.PlatformOperatorUncheckedCreateInput {
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    role: snapshot.role,
    status: snapshot.status,
    grantedByUserId: snapshot.grantedByUserId ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    revokedAt: snapshot.revokedAt ?? null,
  };
}

function toOperator(record: {
  id: string;
  userId: string;
  role: string;
  status: string;
  grantedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}): PlatformOperator {
  return PlatformOperator.reconstitute({
    id: createPlatformOperatorId(record.id),
    userId: record.userId,
    role: parsePlatformRole(record.role),
    status: parseOperatorStatus(record.status),
    grantedByUserId: record.grantedByUserId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revokedAt: record.revokedAt ?? undefined,
  });
}

function toFlagRecord(snapshot: FeatureFlagSnapshot): Prisma.PlatformFeatureFlagUncheckedCreateInput {
  return {
    id: snapshot.id,
    key: snapshot.key,
    description: snapshot.description ?? null,
    enabled: snapshot.enabled,
    createdBy: snapshot.createdBy ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toFlag(record: {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FeatureFlag {
  return FeatureFlag.reconstitute({
    id: createFeatureFlagId(record.id),
    key: record.key,
    description: record.description ?? undefined,
    enabled: record.enabled,
    createdBy: record.createdBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toOverrideRecord(
  snapshot: FeatureFlagOverrideSnapshot,
): Prisma.PlatformFeatureFlagOverrideUncheckedCreateInput {
  return {
    id: snapshot.id,
    flagId: snapshot.flagId,
    organizationId: snapshot.organizationId,
    enabled: snapshot.enabled,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toOverride(record: {
  id: string;
  flagId: string;
  organizationId: string;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): FeatureFlagOverride {
  return FeatureFlagOverride.reconstitute({
    id: createFeatureFlagOverrideId(record.id),
    flagId: createFeatureFlagId(record.flagId),
    organizationId: record.organizationId,
    enabled: record.enabled,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toAuditRecord(
  snapshot: OperationalAuditEventSnapshot,
): Prisma.PlatformOperationalAuditLogUncheckedCreateInput {
  return {
    id: snapshot.id,
    actorId: snapshot.actorId ?? null,
    action: snapshot.action,
    resourceType: snapshot.resourceType,
    resourceId: snapshot.resourceId ?? null,
    outcome: snapshot.outcome,
    organizationId: snapshot.organizationId ?? null,
    metadata: (snapshot.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    ipAddress: snapshot.ipAddress ?? null,
    userAgent: snapshot.userAgent ?? null,
    requestId: snapshot.requestId ?? null,
    occurredAt: snapshot.occurredAt,
  };
}

function toAuditEvent(record: {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  organizationId: string | null;
  metadata: Prisma.JsonValue;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  occurredAt: Date;
}): OperationalAuditEvent {
  return OperationalAuditEvent.reconstitute({
    id: createOperationalAuditEventId(record.id),
    actorId: record.actorId ?? undefined,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId ?? undefined,
    outcome: parseAuditOutcome(record.outcome),
    organizationId: record.organizationId ?? undefined,
    metadata: jsonRecord(record.metadata),
    ipAddress: record.ipAddress ?? undefined,
    userAgent: record.userAgent ?? undefined,
    requestId: record.requestId ?? undefined,
    occurredAt: record.occurredAt,
  });
}

function toAuditWhere(filter?: OperationalAuditListFilter): Prisma.PlatformOperationalAuditLogWhereInput {
  if (!filter) {
    return {};
  }
  return {
    action: filter.action,
    outcome: filter.outcome,
    resourceType: filter.resourceType,
    organizationId: filter.organizationId,
    actorId: filter.actorId,
  };
}
