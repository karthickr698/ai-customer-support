import type { Logger } from '@ai-customer-support/shared';
import type { AIServicePort } from '../../ai/application/ports/ai-service-port.js';
import {
  AIProviderError,
  AIServiceUnavailableError,
  InvalidAIPayloadError,
} from '../../ai/application/errors.js';
import { KnowledgeDocumentNotFoundError } from '../domain/errors.js';
import { createKnowledgeDocumentId } from '../domain/knowledge-document-id.js';
import type { KnowledgeDocument } from '../domain/knowledge-document.js';
import type {
  KnowledgeDocumentDeleteIndexJob,
  KnowledgeDocumentIngestJob,
} from './knowledge-queues.js';
import type { KnowledgeDocumentRepository } from './ports/knowledge-document-repository.js';
import type { KnowledgeDocumentStoragePort } from './ports/knowledge-document-storage-port.js';
import type { ApplyKnowledgeDocumentIngestionResultUseCase } from './use-cases/apply-knowledge-document-ingestion-result-use-case.js';

export class ProcessKnowledgeDocumentIngestion {
  constructor(
    private readonly documents: KnowledgeDocumentRepository,
    private readonly storage: KnowledgeDocumentStoragePort,
    private readonly ai: AIServicePort,
    private readonly applyResult: ApplyKnowledgeDocumentIngestionResultUseCase,
    private readonly logger: Logger,
  ) {}

  async ingest(job: KnowledgeDocumentIngestJob): Promise<void> {
    const document = await this.documents.findById(
      job.tenantId,
      createKnowledgeDocumentId(job.documentId),
    );
    if (!document) {
      this.logger.warn('Ingestion job skipped; document not found', {
        tenantId: job.tenantId,
        documentId: job.documentId,
      });
      return;
    }

    try {
      const result = await this.ai.ingestKnowledgeDocument(
        {
          tenantId: job.tenantId,
          requestId: job.requestId,
          correlationId: job.correlationId,
        },
        await this.toIngestRequest(document, job.replacePreviousVersion),
      );
      await this.applyResult.execute({
        tenantId: job.tenantId,
        documentId: document.id,
        version: job.version,
        result,
        correlationId: job.correlationId,
      });
    } catch (error: unknown) {
      const code =
        error instanceof InvalidAIPayloadError
          ? 'INVALID_AI_PAYLOAD'
          : error instanceof AIServiceUnavailableError
            ? 'AI_SERVICE_UNAVAILABLE'
            : error instanceof AIProviderError
              ? 'AI_PROVIDER_ERROR'
              : 'INGESTION_FAILED';
      const message = error instanceof Error ? error.message : 'Document ingestion failed';
      this.logger.warn('Knowledge document ingestion failed', {
        tenantId: job.tenantId,
        documentId: job.documentId,
        version: job.version,
        code,
      });
      await this.applyResult.execute({
        tenantId: job.tenantId,
        documentId: document.id,
        version: job.version,
        result: {
          schemaVersion: 1,
          documentId: document.id,
          version: job.version,
          status: 'failed',
          chunkCount: 0,
          embeddingModel: '',
          parser: '',
          checksum: document.checksum ?? '',
          metadata: {
            title: document.title,
            kind: document.kind,
            characterCount: 0,
            sourceUri: document.sourceUri ?? null,
            mediaType: document.mediaType ?? null,
          },
          failureCode: code,
          failureMessage: message,
        },
        correlationId: job.correlationId,
      });
    }
  }

  async deleteIndex(job: KnowledgeDocumentDeleteIndexJob): Promise<void> {
    try {
      await this.ai.deleteIndexedKnowledgeDocument(
        {
          tenantId: job.tenantId,
          requestId: job.requestId,
          correlationId: job.correlationId,
        },
        { documentId: job.documentId },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Index delete failed';
      this.logger.warn('Knowledge document index delete failed', {
        tenantId: job.tenantId,
        documentId: job.documentId,
        message,
      });
    }
  }

  private async toIngestRequest(document: KnowledgeDocument, replacePreviousVersion: boolean) {
    const snapshot = document.toSnapshot();
    if (snapshot.kind === 'pdf' || snapshot.kind === 'docx') {
      if (!snapshot.storageKey) {
        throw new KnowledgeDocumentNotFoundError();
      }
      const file = await this.storage.read(snapshot.storageKey);
      return {
        schemaVersion: 1 as const,
        documentId: snapshot.id,
        kind: snapshot.kind,
        version: snapshot.version,
        title: snapshot.title,
        replacePreviousVersion,
        sourceUri: snapshot.sourceUri,
        mediaType: snapshot.mediaType,
        checksum: snapshot.checksum,
        content: file.bytes.toString('base64'),
        contentEncoding: 'base64' as const,
      };
    }

    return {
      schemaVersion: 1 as const,
      documentId: snapshot.id,
      kind: snapshot.kind,
      version: snapshot.version,
      title: snapshot.title,
      replacePreviousVersion,
      sourceUri: snapshot.sourceUri,
      mediaType: snapshot.mediaType,
      checksum: snapshot.checksum,
      content: snapshot.kind === 'article' ? snapshot.articleText : undefined,
      contentEncoding: snapshot.kind === 'article' ? ('utf8' as const) : undefined,
    };
  }
}
