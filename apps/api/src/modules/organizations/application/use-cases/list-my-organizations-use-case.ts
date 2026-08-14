import type { OrganizationWithMembershipDto } from '@ai-customer-support/contracts';
import { toOrganizationWithMembershipDto } from '../dtos.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationRepository } from '../ports/organization-repository.js';

export class ListMyOrganizationsUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  async execute(actorId: string): Promise<{ organizations: OrganizationWithMembershipDto[] }> {
    const memberships = (await this.memberships.listByUser(actorId)).filter((membership) => membership.isActive);
    const organizations = await this.organizations.findByIds(memberships.map((membership) => membership.organizationId));
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));

    const items: OrganizationWithMembershipDto[] = [];
    for (const membership of memberships) {
      const organization = organizationById.get(membership.organizationId);
      if (!organization || organization.status === 'disabled') {
        continue;
      }

      items.push(toOrganizationWithMembershipDto(organization, membership));
    }

    return { organizations: items };
  }
}
