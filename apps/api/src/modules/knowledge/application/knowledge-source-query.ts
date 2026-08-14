import { toKnowledgeSourceDto } from './dtos.js';
import type { KnowledgeSourceRepository } from './ports/knowledge-source-repository.js';

export class KnowledgeSourceQuery {
  constructor(private readonly sources: KnowledgeSourceRepository) {}

  async listByTenant(tenantId: string) {
    const items = await this.sources.listByTenant(tenantId);
    return items.map(toKnowledgeSourceDto);
  }
}
