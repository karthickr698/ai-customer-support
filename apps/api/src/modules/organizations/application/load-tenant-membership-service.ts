import { OrganizationNotFoundError, UnauthorizedOrganizationAccessError } from '../domain/errors.js';
import type { Membership } from '../domain/membership.js';
import type { Organization } from '../domain/organization.js';
import { createOrganizationId } from '../domain/organization-id.js';
import type { MembershipRepository } from './ports/membership-repository.js';
import type { OrganizationRepository } from './ports/organization-repository.js';

export type TenantMembership = {
  readonly organization: Organization;
  readonly membership: Membership;
};

export class LoadTenantMembershipService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  async execute(tenantId: string, userId: string): Promise<TenantMembership> {
    const organization = await this.organizations.findById(createOrganizationId(tenantId));
    if (!organization) {
      throw new OrganizationNotFoundError();
    }

    organization.assertActive();

    const membership = await this.memberships.findByUser(organization.id, userId);
    if (!membership || !membership.isActive) {
      throw new UnauthorizedOrganizationAccessError();
    }

    return { organization, membership };
  }
}
