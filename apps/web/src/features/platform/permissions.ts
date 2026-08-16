import type { PlatformOperatorDto, PlatformPermission } from '@ai-customer-support/contracts';

export function hasPlatformPermission(
  operator: PlatformOperatorDto | undefined,
  permission: PlatformPermission,
): boolean {
  return operator?.permissions.includes(permission) ?? false;
}
