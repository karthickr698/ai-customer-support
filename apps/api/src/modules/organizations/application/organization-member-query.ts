import { createOrganizationId } from '../domain/organization-id.js';
import type { OrganizationRole } from '../domain/permissions.js';
import type { MembershipRepository } from './ports/membership-repository.js';

export type OrganizationMemberProfile = {
  readonly userId: string;
  readonly role: OrganizationRole;
  readonly status: 'active' | 'disabled';
};

export class OrganizationMemberQuery {
  constructor(private readonly memberships: MembershipRepository) {}

  async findActiveMember(
    tenantId: string,
    userId: string,
  ): Promise<OrganizationMemberProfile | null> {
    const membership = await this.memberships.findByUser(createOrganizationId(tenantId), userId);
    if (!membership || !membership.isActive) {
      return null;
    }

    return {
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    };
  }
}
