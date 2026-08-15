import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { PlatformAuditOutcome, PlatformRole } from '@ai-customer-support/contracts';
import type { FeatureFlag } from '../domain/feature-flag.js';
import type { FeatureFlagOverride } from '../domain/feature-flag-override.js';
import type {
  FeatureFlagId,
  OperationalAuditEventId,
  PlatformOperatorId,
} from '../domain/ids.js';
import type { OperationalAuditEvent } from '../domain/operational-audit-event.js';
import type { HealthComponentSnapshot } from '../domain/health-report.js';
import type { PlatformOperator } from '../domain/platform-operator.js';

export type PlatformActor = {
  readonly actorId: string;
  readonly role: PlatformRole;
  readonly permissions: readonly string[];
};

export interface ClockPort {
  now(): Date;
}

export type DirectoryUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'active' | 'disabled';
  readonly emailVerified: boolean;
};

export interface UserDirectoryPort {
  findById(id: string): Promise<DirectoryUser | null>;
  findByEmail(email: string): Promise<DirectoryUser | null>;
}

export type TenantRecord = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: 'active' | 'disabled';
  readonly memberCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type TenantListFilter = {
  readonly status?: 'active' | 'disabled';
  readonly query?: string;
};

export interface TenantDirectoryPort {
  list(page: PageRequest, filter?: TenantListFilter): Promise<Page<TenantRecord>>;
  findById(organizationId: string): Promise<TenantRecord | null>;
  setStatus(
    organizationId: string,
    status: 'active' | 'disabled',
    now: Date,
    correlationId?: string,
  ): Promise<TenantRecord>;
}

export interface PlatformHealthProbePort {
  probe(): Promise<readonly HealthComponentSnapshot[]>;
}

export interface PlatformOperatorRepository {
  save(operator: PlatformOperator): Promise<void>;
  findById(id: PlatformOperatorId): Promise<PlatformOperator | null>;
  findByUserId(userId: string): Promise<PlatformOperator | null>;
  list(includeRevoked?: boolean): Promise<PlatformOperator[]>;
  countActiveOwners(): Promise<number>;
  countActive(): Promise<number>;
}

export interface FeatureFlagRepository {
  save(flag: FeatureFlag): Promise<void>;
  delete(flagId: FeatureFlagId): Promise<void>;
  findById(flagId: FeatureFlagId): Promise<FeatureFlag | null>;
  findByKey(key: string): Promise<FeatureFlag | null>;
  list(): Promise<FeatureFlag[]>;
}

export interface FeatureFlagOverrideRepository {
  save(override: FeatureFlagOverride): Promise<void>;
  delete(flagId: FeatureFlagId, organizationId: string): Promise<void>;
  findByFlagAndTenant(
    flagId: FeatureFlagId,
    organizationId: string,
  ): Promise<FeatureFlagOverride | null>;
  listByFlag(flagId: FeatureFlagId): Promise<FeatureFlagOverride[]>;
  deleteByFlag(flagId: FeatureFlagId): Promise<void>;
}

export type OperationalAuditListFilter = {
  readonly action?: string;
  readonly outcome?: PlatformAuditOutcome;
  readonly resourceType?: string;
  readonly organizationId?: string;
  readonly actorId?: string;
};

export interface OperationalAuditRepository {
  save(event: OperationalAuditEvent): Promise<void>;
  findById(eventId: OperationalAuditEventId): Promise<OperationalAuditEvent | null>;
  list(page: PageRequest, filter?: OperationalAuditListFilter): Promise<Page<OperationalAuditEvent>>;
}
