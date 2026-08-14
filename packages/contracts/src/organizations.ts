export const ORGANIZATION_ROLES = ['owner', 'admin', 'agent', 'viewer'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ORGANIZATION_PERMISSIONS = [
  'organization.read',
  'organization.update',
  'organization.delete',
  'organization.members.manage',
  'organization.invitations.manage',
  'organization.audit.view',
  'conversation.read',
  'conversation.write',
  'conversation.assign',
  'conversation.escalate',
  'ticket.manage',
  'knowledge.manage',
  'analytics.view',
] as const;
export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];

export type OrganizationDto = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: 'active' | 'disabled';
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type OrganizationMembershipDto = {
  readonly id: string;
  readonly role: OrganizationRole;
  readonly permissions: readonly OrganizationPermission[];
};

export type OrganizationWithMembershipDto = OrganizationDto & {
  readonly membership: OrganizationMembershipDto;
};

export type OrganizationMemberDto = {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: OrganizationRole;
  readonly status: 'active' | 'disabled';
  readonly createdAt: string;
};

export type OrganizationInvitationDto = {
  readonly id: string;
  readonly email: string;
  readonly role: Exclude<OrganizationRole, 'owner'>;
  readonly invitedByUserId: string;
  readonly expiresAt: string;
  readonly createdAt: string;
};

export type InvitationPreviewDto = {
  readonly organizationName: string;
  readonly email: string;
  readonly role: Exclude<OrganizationRole, 'owner'>;
  readonly expiresAt: string;
};

export type OrganizationAuditLogDto = {
  readonly id: string;
  readonly action: string;
  readonly actorId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly occurredAt: string;
};

export type CreateOrganizationRequest = {
  readonly name: string;
};

export type UpdateOrganizationRequest = {
  readonly name?: string;
  readonly slug?: string;
};

export type InviteMemberRequest = {
  readonly email: string;
  readonly role: Exclude<OrganizationRole, 'owner'>;
};

export type ChangeMemberRoleRequest = {
  readonly role: OrganizationRole;
};

export type OrganizationListResponse = {
  readonly organizations: readonly OrganizationWithMembershipDto[];
};

export type OrganizationResponse = {
  readonly organization: OrganizationWithMembershipDto;
};

export type OrganizationMembersResponse = {
  readonly members: readonly OrganizationMemberDto[];
};

export type OrganizationInvitationsResponse = {
  readonly invitations: readonly OrganizationInvitationDto[];
};

export type OrganizationInvitationResponse = {
  readonly invitation: OrganizationInvitationDto;
};

export type InvitationPreviewResponse = {
  readonly invitation: InvitationPreviewDto;
};

export type OrganizationAuditLogListResponse = {
  readonly items: readonly OrganizationAuditLogDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isOrganizationWithMembershipDto(
  value: unknown,
): value is OrganizationWithMembershipDto {
  if (!isRecord(value) || !isRecord(value.membership)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.membership.id === 'string' &&
    typeof value.membership.role === 'string' &&
    Array.isArray(value.membership.permissions)
  );
}
