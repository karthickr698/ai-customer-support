import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeSourceDto } from '../dtos.js';
import type { KnowledgeSourceRepository } from '../ports/knowledge-source-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class ListKnowledgeSourcesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly sources: KnowledgeSourceRepository,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const items = await this.sources.listByTenant(actor.tenantId);
    return { items: items.map(toKnowledgeSourceDto) };
  }
}
