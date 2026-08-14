export type KnowledgeSourceId = string & { readonly __brand: 'KnowledgeSourceId' };

export function createKnowledgeSourceId(id: string = crypto.randomUUID()): KnowledgeSourceId {
  return id as KnowledgeSourceId;
}
