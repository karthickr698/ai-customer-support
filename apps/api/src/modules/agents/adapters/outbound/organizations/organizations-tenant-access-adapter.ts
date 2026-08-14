import type { ResolveTenantAccessUseCase } from '../../../../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import type { SupportActor, TenantAccessPort } from '../../../application/ports/tenant-access-port.js';

export class OrganizationsTenantAccessAdapter implements TenantAccessPort {
  constructor(private readonly resolveTenantAccess: ResolveTenantAccessUseCase) {}

  async loadActor(tenantId: string, actorId: string): Promise<SupportActor> {
    const access = await this.resolveTenantAccess.execute({ tenantId, actorId });
    return {
      tenantId: access.tenantId,
      actorId,
      permissions: access.permissions,
    };
  }
}
