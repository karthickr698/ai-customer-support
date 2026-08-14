export type MessageAttachmentId = string & { readonly __brand: 'MessageAttachmentId' };

export function createMessageAttachmentId(id: string = crypto.randomUUID()): MessageAttachmentId {
  return id as MessageAttachmentId;
}
