export type KnowledgeCategoryId = string & { readonly __brand: 'KnowledgeCategoryId' };

export function createKnowledgeCategoryId(id: string = crypto.randomUUID()): KnowledgeCategoryId {
  return id as KnowledgeCategoryId;
}
