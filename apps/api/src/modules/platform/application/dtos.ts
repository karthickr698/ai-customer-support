import type {
  PlatformAuditEventDto,
  PlatformFeatureFlagDto,
  PlatformFeatureFlagEvaluationDto,
  PlatformFeatureFlagOverrideDto,
  PlatformHealthComponentDto,
  PlatformHealthResponse,
  PlatformOperatorDto,
  PlatformTenantDto,
} from '@ai-customer-support/contracts';
import type { FeatureFlag } from '../domain/feature-flag.js';
import type { FeatureFlagEvaluation, FeatureFlagOverride } from '../domain/feature-flag-override.js';
import type { PlatformHealthReport } from '../domain/health-report.js';
import type { OperationalAuditEvent } from '../domain/operational-audit-event.js';
import { permissionsForPlatformRole } from '../domain/permissions.js';
import type { PlatformOperator } from '../domain/platform-operator.js';
import type { DirectoryUser, TenantRecord } from './ports.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toOperatorDto(operator: PlatformOperator, user?: DirectoryUser | null): PlatformOperatorDto {
  const snapshot = operator.toSnapshot();
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    email: user?.email ?? '',
    displayName: user?.displayName ?? '',
    role: snapshot.role,
    status: snapshot.status,
    permissions: permissionsForPlatformRole(snapshot.role),
    grantedByUserId: snapshot.grantedByUserId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
    revokedAt: snapshot.revokedAt?.toISOString() ?? null,
  };
}

export function toTenantDto(tenant: TenantRecord): PlatformTenantDto {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    memberCount: tenant.memberCount,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

export function toOverrideDto(override: FeatureFlagOverride): PlatformFeatureFlagOverrideDto {
  const snapshot = override.toSnapshot();
  return {
    organizationId: snapshot.organizationId,
    enabled: snapshot.enabled,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toFlagDto(
  flag: FeatureFlag,
  overrides: readonly FeatureFlagOverride[] = [],
): PlatformFeatureFlagDto {
  const snapshot = flag.toSnapshot();
  return {
    id: snapshot.id,
    key: snapshot.key,
    description: snapshot.description ?? null,
    enabled: snapshot.enabled,
    createdBy: snapshot.createdBy ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
    overrides: overrides.map(toOverrideDto),
  };
}

export function toEvaluationDto(evaluation: FeatureFlagEvaluation): PlatformFeatureFlagEvaluationDto {
  return {
    key: evaluation.key,
    enabled: evaluation.enabled,
    source: evaluation.source,
    organizationId: evaluation.organizationId ?? null,
  };
}

export function toHealthResponse(report: PlatformHealthReport): PlatformHealthResponse {
  return {
    status: report.status,
    checkedAt: report.checkedAt.toISOString(),
    checks: report.checks.map(
      (check): PlatformHealthComponentDto => ({
        name: check.name,
        status: check.status,
        latencyMs: check.latencyMs,
      }),
    ),
  };
}

export function toAuditEventDto(event: OperationalAuditEvent): PlatformAuditEventDto {
  const snapshot = event.toSnapshot();
  return {
    id: snapshot.id,
    actorId: snapshot.actorId ?? null,
    action: snapshot.action,
    resourceType: snapshot.resourceType,
    resourceId: snapshot.resourceId ?? null,
    outcome: snapshot.outcome,
    organizationId: snapshot.organizationId ?? null,
    metadata: snapshot.metadata ?? null,
    ipAddress: snapshot.ipAddress ?? null,
    occurredAt: snapshot.occurredAt.toISOString(),
  };
}
