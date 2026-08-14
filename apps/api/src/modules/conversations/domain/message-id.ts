export type MessageId = string & { readonly __brand: 'MessageId' };

export function createMessageId(id: string = crypto.randomUUID()): MessageId {
  return id as MessageId;
}
