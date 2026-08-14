export const KNOWLEDGE_DOCUMENT_INGEST_QUEUE = 'knowledge.document.ingest';
export const KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE = 'knowledge.document.delete-index';

export type KnowledgeDocumentIngestJob = {
  readonly tenantId: string;
  readonly documentId: string;
  readonly version: number;
  readonly replacePreviousVersion: boolean;
  readonly requestId: string;
  readonly correlationId: string;
};

export type KnowledgeDocumentDeleteIndexJob = {
  readonly tenantId: string;
  readonly documentId: string;
  readonly requestId: string;
  readonly correlationId: string;
};
