import { toTenantAccess, type TenantAccess } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';

export class ResolveTenantAccessUseCase {
  constructor(private readonly tenantMemberships: LoadTenantMembershipService) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }): Promise<TenantAccess> {
    const { membership } = await this.tenantMemberships.execute(input.tenantId, input.actorId);
    return toTenantAccess(membership);
  }
}
