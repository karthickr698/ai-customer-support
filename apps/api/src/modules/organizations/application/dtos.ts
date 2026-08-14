import type {
  OrganizationAuditLogDto,
  OrganizationDto,
  OrganizationInvitationDto,
  OrganizationMemberDto,
  OrganizationWithMembershipDto,
} from '@ai-customer-support/contracts';
import type { OrganizationAuditLogEntry } from './ports/organization-audit-log-port.js';
import type { Invitation } from '../domain/invitation.js';
import type { Membership } from '../domain/membership.js';
import type { Organization } from '../domain/organization.js';
import { permissionsForRole, type Permission } from '../domain/permissions.js';
import type { DirectoryUser } from './ports/user-directory-port.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export type TenantAccess = {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly role: Membership['role'];
  readonly permissions: readonly Permission[];
};

export function toOrganizationDto(organization: Organization): OrganizationDto {
  const snapshot = organization.toSnapshot();
  return {
    id: snapshot.id,
    name: snapshot.name,
    slug: snapshot.slug,
    status: snapshot.status,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toOrganizationWithMembershipDto(
  organization: Organization,
  membership: Membership,
): OrganizationWithMembershipDto {
  return {
    ...toOrganizationDto(organization),
    membership: {
      id: membership.id,
      role: membership.role,
      permissions: permissionsForRole(membership.role),
    },
  };
}

export function toMemberDto(membership: Membership, user: DirectoryUser | null): OrganizationMemberDto {
  return {
    id: membership.id,
    userId: membership.userId,
    email: user?.email ?? '',
    displayName: user?.displayName ?? 'Unknown member',
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
  };
}

export function toInvitationDto(invitation: Invitation): OrganizationInvitationDto {
  const snapshot = invitation.toSnapshot();
  return {
    id: snapshot.id,
    email: snapshot.email,
    role: snapshot.role,
    invitedByUserId: snapshot.invitedByUserId,
    expiresAt: snapshot.expiresAt.toISOString(),
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toAuditLogDto(entry: OrganizationAuditLogEntry): OrganizationAuditLogDto {
  return {
    id: entry.id,
    action: entry.action,
    actorId: entry.actorId ?? null,
    metadata: entry.metadata ?? null,
    occurredAt: entry.occurredAt.toISOString(),
  };
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function toTenantAccess(membership: Membership): TenantAccess {
  return {
    tenantId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    permissions: [...permissionsForRole(membership.role)],
  };
}
