/**
 * Cross-runtime DTOs for platform administration: privileged operators,
 * operational health, feature flags, tenant controls, and audit logs.
 */

export const PLATFORM_ROLES = ['owner', 'admin', 'operator', 'auditor'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_PERMISSIONS = [
  'platform.operators.read',
  'platform.operators.manage',
  'platform.tenants.read',
  'platform.tenants.manage',
  'platform.feature_flags.read',
  'platform.feature_flags.manage',
  'platform.health.read',
  'platform.audit.view',
  'platform.observability.read',
  'platform.observability.manage',
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_OPERATOR_STATUSES = ['active', 'revoked'] as const;
export type PlatformOperatorStatus = (typeof PLATFORM_OPERATOR_STATUSES)[number];

export const PLATFORM_TENANT_STATUSES = ['active', 'disabled'] as const;
export type PlatformTenantStatus = (typeof PLATFORM_TENANT_STATUSES)[number];

export const PLATFORM_HEALTH_STATUSES = ['ok', 'degraded', 'unavailable'] as const;
export type PlatformHealthStatus = (typeof PLATFORM_HEALTH_STATUSES)[number];

export const PLATFORM_COMPONENT_STATUSES = ['up', 'down'] as const;
export type PlatformComponentStatus = (typeof PLATFORM_COMPONENT_STATUSES)[number];

export const PLATFORM_AUDIT_OUTCOMES = ['success', 'denied', 'failure'] as const;
export type PlatformAuditOutcome = (typeof PLATFORM_AUDIT_OUTCOMES)[number];

export const PLATFORM_AUDIT_ACTIONS = [
  'platform.operator.bootstrapped',
  'platform.operator.granted',
  'platform.operator.role_changed',
  'platform.operator.revoked',
  'platform.tenant.suspended',
  'platform.tenant.activated',
  'platform.feature_flag.created',
  'platform.feature_flag.updated',
  'platform.feature_flag.deleted',
  'platform.feature_flag.override_set',
  'platform.feature_flag.override_removed',
] as const;
export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];

export const PLATFORM_FEATURE_FLAG_KEYS = [
  'ai_replies',
  'widget',
  'public_api',
  'billing',
  'knowledge_ingestion',
  'automations',
  'notifications',
  'analytics',
] as const;
export type PlatformFeatureFlagKey = (typeof PLATFORM_FEATURE_FLAG_KEYS)[number];

export const PLATFORM_FLAG_SOURCES = ['global', 'tenant_override'] as const;
export type PlatformFlagSource = (typeof PLATFORM_FLAG_SOURCES)[number];

export type PlatformOperatorDto = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: PlatformRole;
  readonly status: PlatformOperatorStatus;
  readonly permissions: readonly PlatformPermission[];
  readonly grantedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revokedAt: string | null;
};

export type PlatformOperatorResponse = {
  readonly operator: PlatformOperatorDto;
};

export type PlatformOperatorListResponse = {
  readonly items: readonly PlatformOperatorDto[];
};

export type PlatformMeResponse = {
  readonly operator: PlatformOperatorDto;
  readonly bootstrapAvailable: boolean;
};

export type GrantPlatformOperatorRequest = {
  readonly email: string;
  readonly role: PlatformRole;
};

export type ChangePlatformOperatorRoleRequest = {
  readonly role: PlatformRole;
};

export type PlatformTenantDto = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: PlatformTenantStatus;
  readonly memberCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PlatformTenantResponse = {
  readonly tenant: PlatformTenantDto;
};

export type PlatformTenantListResponse = {
  readonly items: readonly PlatformTenantDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type PlatformFeatureFlagOverrideDto = {
  readonly organizationId: string;
  readonly enabled: boolean;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PlatformFeatureFlagDto = {
  readonly id: string;
  readonly key: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly overrides: readonly PlatformFeatureFlagOverrideDto[];
};

export type PlatformFeatureFlagResponse = {
  readonly flag: PlatformFeatureFlagDto;
};

export type PlatformFeatureFlagListResponse = {
  readonly items: readonly PlatformFeatureFlagDto[];
};

export type CreatePlatformFeatureFlagRequest = {
  readonly key: string;
  readonly description?: string;
  readonly enabled?: boolean;
};

export type UpdatePlatformFeatureFlagRequest = {
  readonly description?: string | null;
  readonly enabled?: boolean;
};

export type SetPlatformFeatureFlagOverrideRequest = {
  readonly enabled: boolean;
};

export type PlatformFeatureFlagEvaluationDto = {
  readonly key: string;
  readonly enabled: boolean;
  readonly source: PlatformFlagSource;
  readonly organizationId: string | null;
};

export type PlatformFeatureFlagEvaluationResponse = {
  readonly evaluation: PlatformFeatureFlagEvaluationDto;
};

export type PlatformHealthComponentDto = {
  readonly name: string;
  readonly status: PlatformComponentStatus;
  readonly latencyMs: number;
};

export type PlatformHealthResponse = {
  readonly status: PlatformHealthStatus;
  readonly checkedAt: string;
  readonly checks: readonly PlatformHealthComponentDto[];
};

export type PlatformAuditEventDto = {
  readonly id: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly outcome: PlatformAuditOutcome;
  readonly organizationId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly ipAddress: string | null;
  readonly occurredAt: string;
};

export type PlatformAuditLogListResponse = {
  readonly items: readonly PlatformAuditEventDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};
