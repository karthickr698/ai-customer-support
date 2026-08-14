import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeDocumentDto } from '../dtos.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class ListKnowledgeDocumentsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly documents: KnowledgeDocumentRepository,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const items = await this.documents.listByTenant(actor.tenantId);
    return { items: items.map(toKnowledgeDocumentDto) };
  }
}
