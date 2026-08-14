export type ConversationNoteId = string & { readonly __brand: 'ConversationNoteId' };

export function createConversationNoteId(id: string = crypto.randomUUID()): ConversationNoteId {
  return id as ConversationNoteId;
}
