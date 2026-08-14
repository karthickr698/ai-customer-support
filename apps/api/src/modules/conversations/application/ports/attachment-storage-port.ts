export type StoredAttachmentFile = {
  readonly bytes: Buffer;
  readonly contentType: string;
};

export interface AttachmentStoragePort {
  save(input: {
    readonly tenantId: string;
    readonly conversationId: string;
    readonly attachmentId: string;
    readonly bytes: Buffer;
  }): Promise<string>;
  read(storageKey: string): Promise<StoredAttachmentFile>;
}
