export type ConversationId = string & { readonly __brand: 'ConversationId' };

export function createConversationId(id: string = crypto.randomUUID()): ConversationId {
  return id as ConversationId;
}
