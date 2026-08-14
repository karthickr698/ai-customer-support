export const ORGANIZATION_RATE_LIMITS = {
  createOrganization: { limit: 10, windowSeconds: 60 * 60 },
  inviteMember: { limit: 20, windowSeconds: 60 * 60 },
  acceptInvitationIp: { limit: 20, windowSeconds: 15 * 60 },
} as const;
