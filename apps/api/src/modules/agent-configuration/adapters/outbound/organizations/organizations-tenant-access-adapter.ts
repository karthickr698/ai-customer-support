import type { ResolveTenantAccessUseCase } from '../../../../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import type { TenantAccessPort, AiAgentActor } from '../../../application/ports/tenant-access-port.js';

export class OrganizationsTenantAccessAdapter implements TenantAccessPort {
  constructor(private readonly resolveTenantAccess: ResolveTenantAccessUseCase) {}

  async loadActor(tenantId: string, actorId: string): Promise<AiAgentActor> {
    const access = await this.resolveTenantAccess.execute({ tenantId, actorId });
    return {
      tenantId: access.tenantId,
      actorId,
      permissions: access.permissions,
    };
  }
}
