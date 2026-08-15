import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  SecurityAuditListFilter,
  SecurityAuditRepository,
  SecurityIpAllowlistRepository,
  SecurityPolicyRepository,
  SecuritySecretRepository,
} from '../../../application/ports.js';
import { SecurityAuditEvent, type SecurityAuditEventSnapshot } from '../../../domain/security-audit-event.js';
import {
  createSecurityAuditEventId,
  createSecurityIpAllowlistEntryId,
  createSecuritySecretId,
  type SecurityAuditEventId,
  type SecurityIpAllowlistEntryId,
  type SecuritySecretId,
} from '../../../domain/ids.js';
import {
  SecurityIpAllowlistEntry,
  type SecurityIpAllowlistEntrySnapshot,
} from '../../../domain/ip-allowlist-entry.js';
import { SecurityPolicy, type SecurityPolicySnapshot } from '../../../domain/security-policy.js';
import { SecuritySecret, type SecuritySecretSnapshot } from '../../../domain/security-secret.js';
import { jsonRecord, parseAuditOutcome, parseSecretPurpose } from '../../../domain/values.js';

export class PostgresSecurityPolicyRepository implements SecurityPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(policy: SecurityPolicy): Promise<void> {
    const snapshot = policy.toSnapshot();
    const data = toPolicyRecord(snapshot);
    await this.prisma.securityPolicy.upsert({
      where: { organizationId: snapshot.organizationId },
      create: data,
      update: {
        ipAllowlistEnabled: data.ipAllowlistEnabled,
        mfaRequired: data.mfaRequired,
        sessionIdleTimeoutSeconds: data.sessionIdleTimeoutSeconds,
        maxRequestBytes: data.maxRequestBytes,
        rateLimitPerMinute: data.rateLimitPerMinute,
        auditRetentionDays: data.auditRetentionDays,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findByTenant(tenantId: string): Promise<SecurityPolicy | null> {
    const record = await this.prisma.securityPolicy.findUnique({
      where: { organizationId: tenantId },
    });
    return record ? toPolicy(record) : null;
  }
}

export class PostgresSecurityIpAllowlistRepository implements SecurityIpAllowlistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(entry: SecurityIpAllowlistEntry): Promise<void> {
    const snapshot = entry.toSnapshot();
    const data = toAllowlistRecord(snapshot);
    await this.prisma.securityIpAllowlistEntry.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        cidr: data.cidr,
        label: data.label,
      },
    });
  }

  async delete(tenantId: string, entryId: SecurityIpAllowlistEntryId): Promise<void> {
    await this.prisma.securityIpAllowlistEntry.deleteMany({
      where: { id: entryId, organizationId: tenantId },
    });
  }

  async findById(
    tenantId: string,
    entryId: SecurityIpAllowlistEntryId,
  ): Promise<SecurityIpAllowlistEntry | null> {
    const record = await this.prisma.securityIpAllowlistEntry.findFirst({
      where: { id: entryId, organizationId: tenantId },
    });
    return record ? toAllowlistEntry(record) : null;
  }

  async findByCidr(tenantId: string, cidr: string): Promise<SecurityIpAllowlistEntry | null> {
    const record = await this.prisma.securityIpAllowlistEntry.findFirst({
      where: { organizationId: tenantId, cidr },
    });
    return record ? toAllowlistEntry(record) : null;
  }

  async listByTenant(tenantId: string): Promise<SecurityIpAllowlistEntry[]> {
    const records = await this.prisma.securityIpAllowlistEntry.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toAllowlistEntry);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.securityIpAllowlistEntry.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresSecuritySecretRepository implements SecuritySecretRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(secret: SecuritySecret): Promise<void> {
    const snapshot = secret.toSnapshot();
    const data = toSecretRecord(snapshot);
    await this.prisma.securitySecret.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        purpose: data.purpose,
        ciphertext: data.ciphertext,
        nonce: data.nonce,
        keyVersion: data.keyVersion,
        lastAccessedAt: data.lastAccessedAt,
        rotatedAt: data.rotatedAt,
        revokedAt: data.revokedAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, secretId: SecuritySecretId): Promise<SecuritySecret | null> {
    const record = await this.prisma.securitySecret.findFirst({
      where: { id: secretId, organizationId: tenantId },
    });
    return record ? toSecret(record) : null;
  }

  async findByName(tenantId: string, name: string): Promise<SecuritySecret | null> {
    const record = await this.prisma.securitySecret.findFirst({
      where: { organizationId: tenantId, name },
    });
    return record ? toSecret(record) : null;
  }

  async listByTenant(tenantId: string): Promise<SecuritySecret[]> {
    const records = await this.prisma.securitySecret.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toSecret);
  }

  async countActiveByTenant(tenantId: string): Promise<number> {
    return this.prisma.securitySecret.count({
      where: { organizationId: tenantId, revokedAt: null },
    });
  }
}

export class PostgresSecurityAuditRepository implements SecurityAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(event: SecurityAuditEvent): Promise<void> {
    const snapshot = event.toSnapshot();
    await this.prisma.securityAuditEvent.create({ data: toAuditRecord(snapshot) });
  }

  async findById(tenantId: string, eventId: SecurityAuditEventId): Promise<SecurityAuditEvent | null> {
    const record = await this.prisma.securityAuditEvent.findFirst({
      where: { id: eventId, organizationId: tenantId },
    });
    return record ? toAuditEvent(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: SecurityAuditListFilter,
  ): Promise<Page<SecurityAuditEvent>> {
    const skip = (page.page - 1) * page.pageSize;
    const where: Prisma.SecurityAuditEventWhereInput = {
      organizationId: tenantId,
      ...(filter?.action ? { action: filter.action } : {}),
      ...(filter?.outcome ? { outcome: filter.outcome } : {}),
      ...(filter?.resourceType ? { resourceType: filter.resourceType } : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.securityAuditEvent.count({ where }),
      this.prisma.securityAuditEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: page.pageSize,
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

function toPolicyRecord(snapshot: SecurityPolicySnapshot): Prisma.SecurityPolicyUncheckedCreateInput {
  return {
    organizationId: snapshot.organizationId,
    ipAllowlistEnabled: snapshot.ipAllowlistEnabled,
    mfaRequired: snapshot.mfaRequired,
    sessionIdleTimeoutSeconds: snapshot.sessionIdleTimeoutSeconds,
    maxRequestBytes: snapshot.maxRequestBytes,
    rateLimitPerMinute: snapshot.rateLimitPerMinute,
    auditRetentionDays: snapshot.auditRetentionDays,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toPolicy(record: {
  organizationId: string;
  ipAllowlistEnabled: boolean;
  mfaRequired: boolean;
  sessionIdleTimeoutSeconds: number;
  maxRequestBytes: number;
  rateLimitPerMinute: number;
  auditRetentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}): SecurityPolicy {
  return SecurityPolicy.reconstitute({
    organizationId: record.organizationId,
    ipAllowlistEnabled: record.ipAllowlistEnabled,
    mfaRequired: record.mfaRequired,
    sessionIdleTimeoutSeconds: record.sessionIdleTimeoutSeconds,
    maxRequestBytes: record.maxRequestBytes,
    rateLimitPerMinute: record.rateLimitPerMinute,
    auditRetentionDays: record.auditRetentionDays,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toAllowlistRecord(
  snapshot: SecurityIpAllowlistEntrySnapshot,
): Prisma.SecurityIpAllowlistEntryUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    cidr: snapshot.cidr,
    label: snapshot.label ?? null,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
  };
}

function toAllowlistEntry(record: {
  id: string;
  organizationId: string;
  cidr: string;
  label: string | null;
  createdBy: string;
  createdAt: Date;
}): SecurityIpAllowlistEntry {
  return SecurityIpAllowlistEntry.reconstitute({
    id: createSecurityIpAllowlistEntryId(record.id),
    organizationId: record.organizationId,
    cidr: record.cidr,
    label: record.label ?? undefined,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
  });
}

function toSecretRecord(snapshot: SecuritySecretSnapshot): Prisma.SecuritySecretUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    purpose: snapshot.purpose,
    ciphertext: snapshot.ciphertext,
    nonce: snapshot.nonce,
    keyVersion: snapshot.keyVersion,
    lastAccessedAt: snapshot.lastAccessedAt ?? null,
    rotatedAt: snapshot.rotatedAt ?? null,
    revokedAt: snapshot.revokedAt ?? null,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toSecret(record: {
  id: string;
  organizationId: string;
  name: string;
  purpose: string;
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  lastAccessedAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): SecuritySecret {
  return SecuritySecret.reconstitute({
    id: createSecuritySecretId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    purpose: parseSecretPurpose(record.purpose),
    ciphertext: record.ciphertext,
    nonce: record.nonce,
    keyVersion: record.keyVersion,
    lastAccessedAt: record.lastAccessedAt ?? undefined,
    rotatedAt: record.rotatedAt ?? undefined,
    revokedAt: record.revokedAt ?? undefined,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toAuditRecord(snapshot: SecurityAuditEventSnapshot): Prisma.SecurityAuditEventUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    actorId: snapshot.actorId ?? null,
    action: snapshot.action,
    resourceType: snapshot.resourceType,
    resourceId: snapshot.resourceId ?? null,
    outcome: snapshot.outcome,
    metadata: (snapshot.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    ipAddress: snapshot.ipAddress ?? null,
    userAgent: snapshot.userAgent ?? null,
    requestId: snapshot.requestId ?? null,
    occurredAt: snapshot.occurredAt,
  };
}

function toAuditEvent(record: {
  id: string;
  organizationId: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  metadata: Prisma.JsonValue;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  occurredAt: Date;
}): SecurityAuditEvent {
  return SecurityAuditEvent.reconstitute({
    id: createSecurityAuditEventId(record.id),
    organizationId: record.organizationId,
    actorId: record.actorId ?? undefined,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId ?? undefined,
    outcome: parseAuditOutcome(record.outcome),
    metadata: jsonRecord(record.metadata),
    ipAddress: record.ipAddress ?? undefined,
    userAgent: record.userAgent ?? undefined,
    requestId: record.requestId ?? undefined,
    occurredAt: record.occurredAt,
  });
}
