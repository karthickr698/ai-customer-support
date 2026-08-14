import { createHash } from 'node:crypto';
import type { DomainEvent, EventBus, Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../shared/application/ports/queue-port.js';
import { KnowledgeDocument } from '../domain/knowledge-document.js';
import { createKnowledgeSourceId } from '../domain/knowledge-source-id.js';
import { MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT } from '../domain/knowledge-document-kind.js';
import { publishAndEnqueue } from './use-cases/register-knowledge-document-use-case.js';
import type { ClockPort } from './ports/clock-port.js';
import type { KnowledgeDocumentRepository } from './ports/knowledge-document-repository.js';
import type { KnowledgeSourceRepository } from './ports/knowledge-source-repository.js';

export class RegisterDocumentFromKnowledgeSource {
  constructor(
    private readonly sources: KnowledgeSourceRepository,
    private readonly documents: KnowledgeDocumentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly queue: QueuePort,
    private readonly logger: Logger,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventName !== 'KnowledgeSourceRegistered') {
      return;
    }
    const knowledgeSourceId =
      'knowledgeSourceId' in event && typeof (event as { knowledgeSourceId?: unknown }).knowledgeSourceId === 'string'
        ? (event as { knowledgeSourceId: string }).knowledgeSourceId
        : '';
    const tenantId = event.tenantId;
    if (!knowledgeSourceId || !tenantId) {
      return;
    }

    const source = await this.sources.findById(tenantId, createKnowledgeSourceId(knowledgeSourceId));
    if (!source) {
      return;
    }

    const snapshot = source.toSnapshot();
    const kind = snapshot.type === 'text' ? 'article' : snapshot.url ? 'url' : null;
    if (!kind) {
      return;
    }

    const count = await this.documents.countByTenant(tenantId);
    if (count >= MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT) {
      this.logger.warn('Skipped source ingestion; document limit reached', { tenantId });
      return;
    }

    const now = this.clock.now();
    const articleText = kind === 'article' ? snapshot.description : undefined;
    const document = KnowledgeDocument.create({
      organizationId: tenantId,
      kind,
      title: snapshot.name,
      sourceUri: snapshot.url,
      articleText,
      sourceId: snapshot.id,
      checksum: articleText ? createHash('sha256').update(articleText).digest('hex') : undefined,
      createdByUserId: snapshot.createdByUserId,
      now,
    });
    document.markProcessing(now);
    await this.documents.save(document);
    await publishAndEnqueue(this.eventBus, this.queue, {
      document,
      actorId: snapshot.createdByUserId,
      now,
      replacePreviousVersion: false,
      security: {
        ipAddress: '',
        requestId: event.eventId,
        correlationId: event.correlationId,
      },
    });
  }
}
