import type { KnowledgeSource } from '../../domain/knowledge-source.js';
import type { KnowledgeSourceId } from '../../domain/knowledge-source-id.js';

export interface KnowledgeSourceRepository {
  findById(tenantId: string, sourceId: KnowledgeSourceId): Promise<KnowledgeSource | null>;
  save(source: KnowledgeSource): Promise<void>;
  delete(tenantId: string, sourceId: KnowledgeSourceId): Promise<void>;
  listByTenant(tenantId: string): Promise<KnowledgeSource[]>;
  countByTenant(tenantId: string): Promise<number>;
}
