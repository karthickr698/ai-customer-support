export type KnowledgeArticleId = string & { readonly __brand: 'KnowledgeArticleId' };

export function createKnowledgeArticleId(id: string = crypto.randomUUID()): KnowledgeArticleId {
  return id as KnowledgeArticleId;
}
