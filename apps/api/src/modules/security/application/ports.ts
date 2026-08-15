import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { SecurityAuditOutcome } from '@ai-customer-support/contracts';
import type { EncryptionEnvelope } from '../domain/encryption-envelope.js';
import type { SecurityAuditEvent } from '../domain/security-audit-event.js';
import type { SecurityIpAllowlistEntry } from '../domain/ip-allowlist-entry.js';
import type { SecurityPolicy } from '../domain/security-policy.js';
import type { SecuritySecret } from '../domain/security-secret.js';
import type {
  SecurityAuditEventId,
  SecurityIpAllowlistEntryId,
  SecuritySecretId,
} from '../domain/ids.js';

export type SecurityActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<SecurityActor>;
}

export interface ClockPort {
  now(): Date;
}

export interface SecretCipherPort {
  readonly keyVersion: number;
  encrypt(plaintext: string): EncryptionEnvelope;
  decrypt(envelope: EncryptionEnvelope): string;
}

export type RateLimitWindow = {
  readonly used: number;
  readonly ttlSeconds: number;
};

export interface RateLimiterPort {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitWindow>;
  peek(key: string): Promise<RateLimitWindow>;
}

export interface SecurityPolicyRepository {
  save(policy: SecurityPolicy): Promise<void>;
  findByTenant(tenantId: string): Promise<SecurityPolicy | null>;
}

export interface SecurityIpAllowlistRepository {
  save(entry: SecurityIpAllowlistEntry): Promise<void>;
  delete(tenantId: string, entryId: SecurityIpAllowlistEntryId): Promise<void>;
  findById(tenantId: string, entryId: SecurityIpAllowlistEntryId): Promise<SecurityIpAllowlistEntry | null>;
  findByCidr(tenantId: string, cidr: string): Promise<SecurityIpAllowlistEntry | null>;
  listByTenant(tenantId: string): Promise<SecurityIpAllowlistEntry[]>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface SecuritySecretRepository {
  save(secret: SecuritySecret): Promise<void>;
  findById(tenantId: string, secretId: SecuritySecretId): Promise<SecuritySecret | null>;
  findByName(tenantId: string, name: string): Promise<SecuritySecret | null>;
  listByTenant(tenantId: string): Promise<SecuritySecret[]>;
  countActiveByTenant(tenantId: string): Promise<number>;
}

export type SecurityAuditListFilter = {
  readonly action?: string;
  readonly outcome?: SecurityAuditOutcome;
  readonly resourceType?: string;
};

export interface SecurityAuditRepository {
  save(event: SecurityAuditEvent): Promise<void>;
  findById(tenantId: string, eventId: SecurityAuditEventId): Promise<SecurityAuditEvent | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: SecurityAuditListFilter,
  ): Promise<Page<SecurityAuditEvent>>;
}
