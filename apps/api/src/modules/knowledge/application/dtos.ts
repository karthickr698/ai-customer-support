import type { KnowledgeDocumentDto, KnowledgeSourceDto } from '@ai-customer-support/contracts';
import type { KnowledgeDocument } from '../domain/knowledge-document.js';
import type { KnowledgeSource } from '../domain/knowledge-source.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toKnowledgeSourceDto(source: KnowledgeSource): KnowledgeSourceDto {
  const snapshot = source.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    type: snapshot.type,
    name: snapshot.name,
    url: snapshot.url ?? null,
    description: snapshot.description ?? null,
    status: snapshot.status,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toKnowledgeDocumentDto(document: KnowledgeDocument): KnowledgeDocumentDto {
  const snapshot = document.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    sourceId: snapshot.sourceId ?? null,
    kind: snapshot.kind,
    title: snapshot.title,
    sourceUri: snapshot.sourceUri ?? null,
    mediaType: snapshot.mediaType ?? null,
    fileName: snapshot.fileName ?? null,
    checksum: snapshot.checksum ?? null,
    status: snapshot.status,
    version: snapshot.version,
    chunkCount: snapshot.chunkCount,
    embeddingModel: snapshot.embeddingModel ?? null,
    parser: snapshot.parser ?? null,
    failureCode: snapshot.failureCode ?? null,
    failureMessage: snapshot.failureMessage ?? null,
    indexedAt: snapshot.indexedAt?.toISOString() ?? null,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
