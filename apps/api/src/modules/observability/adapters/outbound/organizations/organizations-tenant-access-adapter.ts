import type { ResolveTenantAccessUseCase } from '../../../../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import type { ObservabilityActor, TenantAccessPort } from '../../../application/ports.js';

export class OrganizationsTenantAccessAdapter implements TenantAccessPort {
  constructor(private readonly resolveTenantAccess: ResolveTenantAccessUseCase) {}

  async loadActor(tenantId: string, actorId: string): Promise<ObservabilityActor> {
    const access = await this.resolveTenantAccess.execute({ tenantId, actorId });
    return {
      actorId,
      organizationId: access.tenantId,
      permissions: access.permissions,
    };
  }
}
