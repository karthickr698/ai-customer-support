import type { KnowledgeDocumentStatus } from '@ai-customer-support/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { KnowledgeDocumentRepository } from '../../../application/ports/knowledge-document-repository.js';
import { KnowledgeDocument, type KnowledgeDocumentSnapshot } from '../../../domain/knowledge-document.js';
import { createKnowledgeDocumentId, type KnowledgeDocumentId } from '../../../domain/knowledge-document-id.js';
import { parseKnowledgeDocumentKind } from '../../../domain/knowledge-document-kind.js';

type KnowledgeDocumentRecord = {
  id: string;
  organizationId: string;
  sourceId: string | null;
  kind: string;
  title: string;
  sourceUri: string | null;
  mediaType: string | null;
  fileName: string | null;
  storageKey: string | null;
  articleText: string | null;
  checksum: string | null;
  status: string;
  version: number;
  chunkCount: number;
  embeddingModel: string | null;
  parser: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  indexedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresKnowledgeDocumentRepository implements KnowledgeDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, documentId: KnowledgeDocumentId): Promise<KnowledgeDocument | null> {
    const record = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, organizationId: tenantId },
    });
    return record ? toDocument(record) : null;
  }

  async save(document: KnowledgeDocument): Promise<void> {
    const snapshot = document.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.knowledgeDocument.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        sourceId: data.sourceId,
        kind: data.kind,
        title: data.title,
        sourceUri: data.sourceUri,
        mediaType: data.mediaType,
        fileName: data.fileName,
        storageKey: data.storageKey,
        articleText: data.articleText,
        checksum: data.checksum,
        status: data.status,
        version: data.version,
        chunkCount: data.chunkCount,
        embeddingModel: data.embeddingModel,
        parser: data.parser,
        failureCode: data.failureCode,
        failureMessage: data.failureMessage,
        indexedAt: data.indexedAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(tenantId: string, documentId: KnowledgeDocumentId): Promise<void> {
    await this.prisma.knowledgeDocument.deleteMany({
      where: { id: documentId, organizationId: tenantId },
    });
  }

  async listByTenant(tenantId: string): Promise<KnowledgeDocument[]> {
    const records = await this.prisma.knowledgeDocument.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDocument);
  }

  async listBySource(tenantId: string, sourceId: string): Promise<KnowledgeDocument[]> {
    const records = await this.prisma.knowledgeDocument.findMany({
      where: { organizationId: tenantId, sourceId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDocument);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.knowledgeDocument.count({ where: { organizationId: tenantId } });
  }
}

function toDocument(record: KnowledgeDocumentRecord): KnowledgeDocument {
  const snapshot: KnowledgeDocumentSnapshot = {
    id: createKnowledgeDocumentId(record.id),
    organizationId: record.organizationId,
    sourceId: record.sourceId ?? undefined,
    kind: parseKnowledgeDocumentKind(record.kind),
    title: record.title,
    sourceUri: record.sourceUri ?? undefined,
    mediaType: record.mediaType ?? undefined,
    fileName: record.fileName ?? undefined,
    storageKey: record.storageKey ?? undefined,
    articleText: record.articleText ?? undefined,
    checksum: record.checksum ?? undefined,
    status: record.status as KnowledgeDocumentStatus,
    version: record.version,
    chunkCount: record.chunkCount,
    embeddingModel: record.embeddingModel ?? undefined,
    parser: record.parser ?? undefined,
    failureCode: record.failureCode ?? undefined,
    failureMessage: record.failureMessage ?? undefined,
    indexedAt: record.indexedAt ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return KnowledgeDocument.reconstitute(snapshot);
}

function toRecord(snapshot: KnowledgeDocumentSnapshot): Prisma.KnowledgeDocumentUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    sourceId: snapshot.sourceId ?? null,
    kind: snapshot.kind,
    title: snapshot.title,
    sourceUri: snapshot.sourceUri ?? null,
    mediaType: snapshot.mediaType ?? null,
    fileName: snapshot.fileName ?? null,
    storageKey: snapshot.storageKey ?? null,
    articleText: snapshot.articleText ?? null,
    checksum: snapshot.checksum ?? null,
    status: snapshot.status,
    version: snapshot.version,
    chunkCount: snapshot.chunkCount,
    embeddingModel: snapshot.embeddingModel ?? null,
    parser: snapshot.parser ?? null,
    failureCode: snapshot.failureCode ?? null,
    failureMessage: snapshot.failureMessage ?? null,
    indexedAt: snapshot.indexedAt ?? null,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
