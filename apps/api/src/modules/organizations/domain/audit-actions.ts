export const OrganizationAuditActions = {
  ORGANIZATION_CREATED: 'organization.created',
  ORGANIZATION_UPDATED: 'organization.updated',
  MEMBER_INVITED: 'organization.member.invited',
  INVITATION_ACCEPTED: 'organization.invitation.accepted',
  INVITATION_REVOKED: 'organization.invitation.revoked',
  MEMBER_ROLE_CHANGED: 'organization.member.role_changed',
  MEMBER_REMOVED: 'organization.member.removed',
  MEMBER_LEFT: 'organization.member.left',
} as const;

export type OrganizationAuditAction =
  (typeof OrganizationAuditActions)[keyof typeof OrganizationAuditActions];
