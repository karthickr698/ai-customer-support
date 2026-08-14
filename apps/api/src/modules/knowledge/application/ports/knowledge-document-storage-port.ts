export type StoredKnowledgeFile = {
  readonly bytes: Buffer;
};

export interface KnowledgeDocumentStoragePort {
  save(input: {
    readonly tenantId: string;
    readonly documentId: string;
    readonly bytes: Buffer;
  }): Promise<string>;
  read(storageKey: string): Promise<StoredKnowledgeFile>;
  delete(storageKey: string): Promise<void>;
}
