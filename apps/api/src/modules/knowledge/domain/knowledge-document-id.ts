export type KnowledgeDocumentId = string & { readonly __brand: 'KnowledgeDocumentId' };

export function createKnowledgeDocumentId(id: string = crypto.randomUUID()): KnowledgeDocumentId {
  return id as KnowledgeDocumentId;
}
