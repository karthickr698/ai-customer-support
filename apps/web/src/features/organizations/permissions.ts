import type {
  OrganizationMemberDto,
  OrganizationPermission,
  OrganizationRole,
} from '@ai-customer-support/contracts';

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

export function roleDescription(role: OrganizationRole): string {
  switch (role) {
    case 'owner':
      return 'Full control, including transferring ownership. Cannot leave while they are the last owner.';
    case 'admin':
      return 'Manages workspace settings, members, and invitations. Cannot delete the workspace or change other owners.';
    case 'agent':
      return 'Handles conversations, tickets, and knowledge. Cannot manage members or workspace settings.';
    case 'viewer':
      return 'Read-only access to conversations, analytics, and workspace details.';
  }
}

export function permissionLabel(permission: OrganizationPermission): string {
  const labels: Record<OrganizationPermission, string> = {
    'organization.read': 'View workspace',
    'organization.update': 'Edit workspace settings',
    'organization.delete': 'Delete workspace',
    'organization.members.manage': 'Manage members',
    'organization.invitations.manage': 'Manage invitations',
    'organization.audit.view': 'View audit log',
    'conversation.read': 'View conversations',
    'conversation.write': 'Reply in conversations',
    'conversation.assign': 'Assign conversations',
    'conversation.escalate': 'Escalate conversations',
    'customer.read': 'View customers',
    'customer.manage': 'Manage customers',
    'ticket.manage': 'Manage tickets',
    'knowledge.manage': 'Manage knowledge',
    'analytics.view': 'View analytics',
    'integration.manage': 'Manage integrations',
    'automation.read': 'View automations',
    'automation.manage': 'Manage automations',
    'notification.read': 'View notifications',
    'notification.manage': 'Manage notifications',
    'billing.read': 'View billing',
    'billing.manage': 'Manage billing',
    'security.read': 'View security',
    'security.manage': 'Manage security',
    'observability.view': 'View observability',
    'observability.manage': 'Manage observability',
  };

  return labels[permission];
}

export const INVITE_ROLES: Array<Exclude<OrganizationRole, 'owner'>> = ['admin', 'agent', 'viewer'];

export function ownerCount(members: readonly OrganizationMemberDto[]): number {
  return members.filter((member) => member.role === 'owner' && member.status === 'active').length;
}

export function canLeaveWorkspace(input: {
  readonly role: OrganizationRole;
  readonly ownerCount: number;
}): boolean {
  return !(input.role === 'owner' && input.ownerCount <= 1);
}

export function memberManagement(input: {
  readonly actorRole: OrganizationRole;
  readonly actorUserId: string;
  readonly actorPermissions: readonly OrganizationPermission[];
  readonly target: OrganizationMemberDto;
  readonly ownerCount: number;
}): {
  readonly changeRole: boolean;
  readonly remove: boolean;
  readonly assignableRoles: readonly OrganizationRole[];
} {
  const canManage = hasPermission(input.actorPermissions, 'organization.members.manage');
  const isSelf = input.actorUserId === input.target.userId;
  const actorIsOwner = input.actorRole === 'owner';
  const targetIsOwner = input.target.role === 'owner';
  const lastOwner = targetIsOwner && input.ownerCount <= 1;

  if (!canManage || isSelf || (targetIsOwner && !actorIsOwner) || lastOwner) {
    return { changeRole: false, remove: false, assignableRoles: [] };
  }

  return {
    changeRole: true,
    remove: true,
    assignableRoles: actorIsOwner ? ['owner', 'admin', 'agent', 'viewer'] : ['admin', 'agent', 'viewer'],
  };
}

export function auditActionLabel(action: string): string {
  switch (action) {
    case 'organization.created':
      return 'Workspace created';
    case 'organization.updated':
      return 'Workspace updated';
    case 'organization.member.invited':
      return 'Member invited';
    case 'organization.invitation.accepted':
      return 'Invitation accepted';
    case 'organization.invitation.revoked':
      return 'Invitation revoked';
    case 'organization.member.role_changed':
      return 'Role changed';
    case 'organization.member.removed':
      return 'Member removed';
    case 'organization.member.left':
      return 'Member left';
    default:
      return action;
  }
}
