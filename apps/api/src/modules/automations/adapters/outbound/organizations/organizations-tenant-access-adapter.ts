import type { ResolveTenantAccessUseCase } from '../../../../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import type { AutomationActor, TenantAccessPort } from '../../../application/ports.js';

export class OrganizationsTenantAccessAdapter implements TenantAccessPort {
  constructor(private readonly resolveTenantAccess: ResolveTenantAccessUseCase) {}

  async loadActor(tenantId: string, actorId: string): Promise<AutomationActor> {
    const access = await this.resolveTenantAccess.execute({ tenantId, actorId });
    return {
      tenantId: access.tenantId,
      actorId,
      permissions: access.permissions,
    };
  }
}
