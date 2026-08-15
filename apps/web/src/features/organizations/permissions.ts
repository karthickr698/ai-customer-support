import type { OrganizationPermission } from '@ai-customer-support/contracts';

export function hasPermission(
  permissions: readonly OrganizationPermission[] | undefined,
  permission: OrganizationPermission,
): boolean {
  return permissions?.includes(permission) ?? false;
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'agent':
      return 'Agent';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}
