import type { OrganizationWithMembershipDto } from '@ai-customer-support/contracts';
import { toOrganizationWithMembershipDto } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';

export class GetOrganizationUseCase {
  constructor(private readonly tenantMemberships: LoadTenantMembershipService) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<{ organization: OrganizationWithMembershipDto }> {
    const { organization, membership } = await this.tenantMemberships.execute(input.tenantId, input.actorId);
    return { organization: toOrganizationWithMembershipDto(organization, membership) };
  }
}
