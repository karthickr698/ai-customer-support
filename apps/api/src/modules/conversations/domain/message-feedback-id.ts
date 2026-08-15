export type MessageFeedbackId = string & { readonly __brand: 'MessageFeedbackId' };

export function createMessageFeedbackId(id: string = crypto.randomUUID()): MessageFeedbackId {
  return id as MessageFeedbackId;
}
