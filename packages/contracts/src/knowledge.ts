/**
 * Cross-runtime DTOs for knowledge documents and RAG ingestion.
 * Python processes documents; TypeScript validates payloads before applying lifecycle.
 */

export const KNOWLEDGE_DOCUMENT_KINDS = ['pdf', 'docx', 'url', 'article'] as const;
export type KnowledgeDocumentKind = (typeof KNOWLEDGE_DOCUMENT_KINDS)[number];

export const KNOWLEDGE_DOCUMENT_STATUSES = ['uploaded', 'processing', 'ready', 'failed'] as const;
export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];

export const KNOWLEDGE_INGEST_SCHEMA_VERSION = 1;
export const KNOWLEDGE_CONTENT_ENCODINGS = ['utf8', 'base64'] as const;
export type KnowledgeContentEncoding = (typeof KNOWLEDGE_CONTENT_ENCODINGS)[number];

export type KnowledgeDocumentDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly sourceId: string | null;
  readonly kind: KnowledgeDocumentKind;
  readonly title: string;
  readonly sourceUri: string | null;
  readonly mediaType: string | null;
  readonly fileName: string | null;
  readonly checksum: string | null;
  readonly status: KnowledgeDocumentStatus;
  readonly version: number;
  readonly chunkCount: number;
  readonly embeddingModel: string | null;
  readonly parser: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly indexedAt: string | null;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RegisterKnowledgeDocumentRequest = {
  readonly kind: Extract<KnowledgeDocumentKind, 'url' | 'article'>;
  readonly title: string;
  readonly url?: string;
  readonly articleText?: string;
  readonly sourceId?: string;
};

export type KnowledgeDocumentResponse = {
  readonly document: KnowledgeDocumentDto;
};

export type KnowledgeDocumentListResponse = {
  readonly items: readonly KnowledgeDocumentDto[];
};

export type KnowledgeDocumentMetadataDto = {
  readonly title: string;
  readonly kind: KnowledgeDocumentKind;
  readonly characterCount: number;
  readonly sourceUri: string | null;
  readonly mediaType: string | null;
};

export type IngestKnowledgeDocumentRequest = {
  readonly schemaVersion: typeof KNOWLEDGE_INGEST_SCHEMA_VERSION;
  readonly documentId: string;
  readonly kind: KnowledgeDocumentKind;
  readonly version: number;
  readonly title: string;
  readonly replacePreviousVersion: boolean;
  readonly sourceUri?: string;
  readonly mediaType?: string;
  readonly checksum?: string;
  readonly content?: string;
  readonly contentEncoding?: KnowledgeContentEncoding;
};

export type IngestKnowledgeDocumentResponse = {
  readonly schemaVersion: typeof KNOWLEDGE_INGEST_SCHEMA_VERSION;
  readonly documentId: string;
  readonly version: number;
  readonly status: 'processed' | 'failed';
  readonly chunkCount: number;
  readonly embeddingModel: string;
  readonly parser: string;
  readonly checksum: string;
  readonly metadata: KnowledgeDocumentMetadataDto;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
};

export type DeleteIndexedKnowledgeDocumentRequest = {
  readonly documentId: string;
};

export type DeleteIndexedKnowledgeDocumentResponse = {
  readonly documentId: string;
  readonly deletedCount: number;
};

export function isKnowledgeDocumentKind(value: unknown): value is KnowledgeDocumentKind {
  return typeof value === 'string' && (KNOWLEDGE_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isKnowledgeDocumentStatus(value: unknown): value is KnowledgeDocumentStatus {
  return typeof value === 'string' && (KNOWLEDGE_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export function isIngestKnowledgeDocumentResponse(value: unknown): value is IngestKnowledgeDocumentResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === KNOWLEDGE_INGEST_SCHEMA_VERSION &&
    isNonEmptyString(value.documentId) &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version) &&
    value.version >= 1 &&
    (value.status === 'processed' || value.status === 'failed') &&
    typeof value.chunkCount === 'number' &&
    Number.isInteger(value.chunkCount) &&
    value.chunkCount >= 0 &&
    typeof value.embeddingModel === 'string' &&
    typeof value.parser === 'string' &&
    typeof value.checksum === 'string' &&
    isKnowledgeDocumentMetadataDto(value.metadata) &&
    isNullableString(value.failureCode) &&
    isNullableString(value.failureMessage)
  );
}

export function isDeleteIndexedKnowledgeDocumentResponse(
  value: unknown,
): value is DeleteIndexedKnowledgeDocumentResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.documentId) &&
    typeof value.deletedCount === 'number' &&
    Number.isInteger(value.deletedCount) &&
    value.deletedCount >= 0
  );
}

function isKnowledgeDocumentMetadataDto(value: unknown): value is KnowledgeDocumentMetadataDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.title) &&
    isKnowledgeDocumentKind(value.kind) &&
    typeof value.characterCount === 'number' &&
    Number.isInteger(value.characterCount) &&
    value.characterCount >= 0 &&
    isNullableString(value.sourceUri) &&
    isNullableString(value.mediaType)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
