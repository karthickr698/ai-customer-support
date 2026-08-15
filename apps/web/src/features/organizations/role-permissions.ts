import {
  ORGANIZATION_PERMISSIONS,
  ORGANIZATION_ROLES,
  type OrganizationPermission,
  type OrganizationRole,
} from '@ai-customer-support/contracts';

const ALL_PERMISSIONS: readonly OrganizationPermission[] = ORGANIZATION_PERMISSIONS;

/** Mirrors `ROLE_PERMISSIONS` in the organizations domain. Roles are fixed — there are no custom roles. */
export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly OrganizationPermission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((permission) => permission !== 'organization.delete'),
  agent: [
    'organization.read',
    'conversation.read',
    'conversation.write',
    'conversation.assign',
    'conversation.escalate',
    'customer.read',
    'ticket.manage',
    'knowledge.manage',
    'automation.read',
    'analytics.view',
    'notification.read',
    'billing.read',
    'security.read',
    'observability.view',
  ],
  viewer: [
    'organization.read',
    'conversation.read',
    'customer.read',
    'analytics.view',
    'notification.read',
    'billing.read',
    'security.read',
    'observability.view',
  ],
};

export const PERMISSION_GROUPS: ReadonlyArray<{
  readonly label: string;
  readonly permissions: readonly OrganizationPermission[];
}> = [
  {
    label: 'Workspace',
    permissions: [
      'organization.read',
      'organization.update',
      'organization.delete',
      'organization.members.manage',
      'organization.invitations.manage',
      'organization.audit.view',
    ],
  },
  {
    label: 'Support',
    permissions: [
      'conversation.read',
      'conversation.write',
      'conversation.assign',
      'conversation.escalate',
      'customer.read',
      'customer.manage',
      'ticket.manage',
    ],
  },
  {
    label: 'Knowledge & automation',
    permissions: ['knowledge.manage', 'automation.read', 'automation.manage'],
  },
  {
    label: 'Operations',
    permissions: [
      'analytics.view',
      'integration.manage',
      'notification.read',
      'notification.manage',
      'billing.read',
      'billing.manage',
      'security.read',
      'security.manage',
      'observability.view',
      'observability.manage',
    ],
  },
];

export const ROLE_ORDER: readonly OrganizationRole[] = ORGANIZATION_ROLES;

export function roleHasPermission(role: OrganizationRole, permission: OrganizationPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
