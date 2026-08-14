import type { IngestKnowledgeDocumentResponse } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { AIProcessingFailedEvent, KnowledgeDocumentProcessedEvent } from '../../domain/events.js';
import { KnowledgeDocumentNotFoundError } from '../../domain/errors.js';
import { createKnowledgeDocumentId } from '../../domain/knowledge-document-id.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeDocumentRepository } from '../ports/knowledge-document-repository.js';

export class ApplyKnowledgeDocumentIngestionResultUseCase {
  constructor(
    private readonly documents: KnowledgeDocumentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly documentId: string;
    readonly version: number;
    readonly result: IngestKnowledgeDocumentResponse;
    readonly correlationId?: string;
  }): Promise<void> {
    const document = await this.documents.findById(
      input.tenantId,
      createKnowledgeDocumentId(input.documentId),
    );
    if (!document) {
      throw new KnowledgeDocumentNotFoundError();
    }
    if (document.version !== input.version) {
      return;
    }
    if (document.status === 'ready' && input.result.status === 'processed') {
      return;
    }
    if (document.status === 'failed' && input.result.status === 'failed') {
      return;
    }

    const now = this.clock.now();
    if (input.result.status === 'processed') {
      document.markReady({
        now,
        chunkCount: input.result.chunkCount,
        embeddingModel: input.result.embeddingModel,
        parser: input.result.parser,
        checksum: input.result.checksum,
      });
      await this.documents.save(document);
      await this.eventBus.publish(
        new KnowledgeDocumentProcessedEvent(
          crypto.randomUUID(),
          now,
          input.tenantId,
          document.id,
          document.version,
          input.result.chunkCount,
          input.correlationId,
        ),
      );
      return;
    }

    document.markFailed({
      now,
      code: input.result.failureCode ?? 'INGESTION_FAILED',
      message: input.result.failureMessage ?? 'Document ingestion failed',
    });
    await this.documents.save(document);
    await this.eventBus.publish(
      new AIProcessingFailedEvent(
        crypto.randomUUID(),
        now,
        input.tenantId,
        document.id,
        document.version,
        input.result.failureCode ?? 'INGESTION_FAILED',
        input.correlationId,
      ),
    );
  }
}
