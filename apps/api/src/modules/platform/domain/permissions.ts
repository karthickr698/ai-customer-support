import type { PlatformPermission, PlatformRole } from '@ai-customer-support/contracts';
import { InsufficientPlatformPermissionError } from './errors.js';

export const PlatformPermissions = {
  OPERATORS_READ: 'platform.operators.read',
  OPERATORS_MANAGE: 'platform.operators.manage',
  TENANTS_READ: 'platform.tenants.read',
  TENANTS_MANAGE: 'platform.tenants.manage',
  FEATURE_FLAGS_READ: 'platform.feature_flags.read',
  FEATURE_FLAGS_MANAGE: 'platform.feature_flags.manage',
  HEALTH_READ: 'platform.health.read',
  AUDIT_VIEW: 'platform.audit.view',
  OBSERVABILITY_READ: 'platform.observability.read',
  OBSERVABILITY_MANAGE: 'platform.observability.manage',
} as const satisfies Record<string, PlatformPermission>;

const ALL_PERMISSIONS: readonly PlatformPermission[] = Object.values(PlatformPermissions);

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((permission) => permission !== PlatformPermissions.OPERATORS_MANAGE),
  operator: [
    PlatformPermissions.OPERATORS_READ,
    PlatformPermissions.TENANTS_READ,
    PlatformPermissions.TENANTS_MANAGE,
    PlatformPermissions.FEATURE_FLAGS_READ,
    PlatformPermissions.HEALTH_READ,
    PlatformPermissions.AUDIT_VIEW,
    PlatformPermissions.OBSERVABILITY_READ,
    PlatformPermissions.OBSERVABILITY_MANAGE,
  ],
  auditor: [
    PlatformPermissions.OPERATORS_READ,
    PlatformPermissions.TENANTS_READ,
    PlatformPermissions.FEATURE_FLAGS_READ,
    PlatformPermissions.HEALTH_READ,
    PlatformPermissions.AUDIT_VIEW,
    PlatformPermissions.OBSERVABILITY_READ,
  ],
};

export function permissionsForPlatformRole(role: PlatformRole): readonly PlatformPermission[] {
  return PLATFORM_ROLE_PERMISSIONS[role];
}

export function roleHasPlatformPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  return PLATFORM_ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPlatformPermission(
  permissions: readonly string[],
  permission: PlatformPermission,
): void {
  if (!permissions.includes(permission)) {
    throw new InsufficientPlatformPermissionError(permission);
  }
}
