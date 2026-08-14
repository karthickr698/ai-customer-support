import type { KnowledgeDocument } from '../../domain/knowledge-document.js';
import type { KnowledgeDocumentId } from '../../domain/knowledge-document-id.js';

export interface KnowledgeDocumentRepository {
  findById(tenantId: string, documentId: KnowledgeDocumentId): Promise<KnowledgeDocument | null>;
  save(document: KnowledgeDocument): Promise<void>;
  delete(tenantId: string, documentId: KnowledgeDocumentId): Promise<void>;
  listByTenant(tenantId: string): Promise<KnowledgeDocument[]>;
  listBySource(tenantId: string, sourceId: string): Promise<KnowledgeDocument[]>;
  countByTenant(tenantId: string): Promise<number>;
}
