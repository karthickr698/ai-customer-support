export const Permissions = {
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_DELETE: 'organization.delete',
  ORGANIZATION_MEMBERS_MANAGE: 'organization.members.manage',
  ORGANIZATION_INVITATIONS_MANAGE: 'organization.invitations.manage',
  ORGANIZATION_AUDIT_VIEW: 'organization.audit.view',
  CONVERSATION_READ: 'conversation.read',
  CONVERSATION_WRITE: 'conversation.write',
  CONVERSATION_ASSIGN: 'conversation.assign',
  CONVERSATION_ESCALATE: 'conversation.escalate',
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_MANAGE: 'customer.manage',
  TICKET_MANAGE: 'ticket.manage',
  KNOWLEDGE_MANAGE: 'knowledge.manage',
  ANALYTICS_VIEW: 'analytics.view',
  INTEGRATION_MANAGE: 'integration.manage',
  AUTOMATION_READ: 'automation.read',
  AUTOMATION_MANAGE: 'automation.manage',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_MANAGE: 'notification.manage',
  BILLING_READ: 'billing.read',
  BILLING_MANAGE: 'billing.manage',
  SECURITY_READ: 'security.read',
  SECURITY_MANAGE: 'security.manage',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ORGANIZATION_ROLES = ['owner', 'admin', 'agent', 'viewer'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type AssignableMemberRole = Exclude<OrganizationRole, 'owner'>;

const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permissions);

export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((permission) => permission !== Permissions.ORGANIZATION_DELETE),
  agent: [
    Permissions.ORGANIZATION_READ,
    Permissions.CONVERSATION_READ,
    Permissions.CONVERSATION_WRITE,
    Permissions.CONVERSATION_ASSIGN,
    Permissions.CONVERSATION_ESCALATE,
    Permissions.CUSTOMER_READ,
    Permissions.TICKET_MANAGE,
    Permissions.KNOWLEDGE_MANAGE,
    Permissions.AUTOMATION_READ,
    Permissions.ANALYTICS_VIEW,
    Permissions.NOTIFICATION_READ,
    Permissions.BILLING_READ,
    Permissions.SECURITY_READ,
  ],
  viewer: [
    Permissions.ORGANIZATION_READ,
    Permissions.CONVERSATION_READ,
    Permissions.CUSTOMER_READ,
    Permissions.ANALYTICS_VIEW,
    Permissions.NOTIFICATION_READ,
    Permissions.BILLING_READ,
    Permissions.SECURITY_READ,
  ],
};

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function isAssignableMemberRole(value: string): value is AssignableMemberRole {
  return value === 'admin' || value === 'agent' || value === 'viewer';
}

export function permissionsForRole(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: OrganizationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
