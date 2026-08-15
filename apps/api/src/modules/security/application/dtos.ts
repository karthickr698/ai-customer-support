import type {
  SecurityAuditEventDto,
  SecurityEncryptionEnvelopeDto,
  SecurityIpAllowlistEntryDto,
  SecurityPolicyDto,
  SecurityRateLimitWindowDto,
  SecuritySecretDto,
} from '@ai-customer-support/contracts';
import type { EncryptionEnvelope } from '../domain/encryption-envelope.js';
import type { SecurityAuditEvent } from '../domain/security-audit-event.js';
import type { SecurityIpAllowlistEntry } from '../domain/ip-allowlist-entry.js';
import type { SecurityPolicy } from '../domain/security-policy.js';
import type { SecuritySecret } from '../domain/security-secret.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toPolicyDto(policy: SecurityPolicy): SecurityPolicyDto {
  const snapshot = policy.toSnapshot();
  return {
    organizationId: snapshot.organizationId,
    ipAllowlistEnabled: snapshot.ipAllowlistEnabled,
    mfaRequired: snapshot.mfaRequired,
    sessionIdleTimeoutSeconds: snapshot.sessionIdleTimeoutSeconds,
    maxRequestBytes: snapshot.maxRequestBytes,
    rateLimitPerMinute: snapshot.rateLimitPerMinute,
    auditRetentionDays: snapshot.auditRetentionDays,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toIpAllowlistDto(entry: SecurityIpAllowlistEntry): SecurityIpAllowlistEntryDto {
  const snapshot = entry.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    cidr: snapshot.cidr,
    label: snapshot.label ?? null,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toSecretDto(secret: SecuritySecret): SecuritySecretDto {
  const snapshot = secret.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    purpose: snapshot.purpose,
    keyVersion: snapshot.keyVersion,
    lastAccessedAt: snapshot.lastAccessedAt?.toISOString() ?? null,
    rotatedAt: snapshot.rotatedAt?.toISOString() ?? null,
    revokedAt: snapshot.revokedAt?.toISOString() ?? null,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toEnvelopeDto(envelope: EncryptionEnvelope): SecurityEncryptionEnvelopeDto {
  return {
    algorithm: envelope.algorithm,
    keyVersion: envelope.keyVersion,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce,
  };
}

export function toAuditEventDto(event: SecurityAuditEvent): SecurityAuditEventDto {
  const snapshot = event.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    actorId: snapshot.actorId ?? null,
    action: snapshot.action,
    resourceType: snapshot.resourceType,
    resourceId: snapshot.resourceId ?? null,
    outcome: snapshot.outcome,
    metadata: snapshot.metadata ?? null,
    ipAddress: snapshot.ipAddress ?? null,
    occurredAt: snapshot.occurredAt.toISOString(),
  };
}

export function toRateLimitWindowDto(input: {
  readonly key: string;
  readonly limit: number;
  readonly used: number;
  readonly windowSeconds: number;
  readonly ttlSeconds: number;
  readonly now: Date;
}): SecurityRateLimitWindowDto {
  const remaining = Math.max(0, input.limit - input.used);
  const resetAt =
    input.ttlSeconds > 0
      ? new Date(input.now.getTime() + input.ttlSeconds * 1_000).toISOString()
      : null;
  return {
    key: input.key,
    limit: input.limit,
    used: input.used,
    remaining,
    windowSeconds: input.windowSeconds,
    resetAt,
  };
}
