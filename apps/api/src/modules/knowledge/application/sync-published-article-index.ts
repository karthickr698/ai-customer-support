import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../shared/application/ports/queue-port.js';
import { KnowledgeDocumentRemovedEvent } from '../domain/events.js';
import { KnowledgeDocument } from '../domain/knowledge-document.js';
import { createKnowledgeDocumentId } from '../domain/knowledge-document-id.js';
import { TooManyKnowledgeDocumentsError } from '../domain/errors.js';
import { MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT } from '../domain/knowledge-document-kind.js';
import { KnowledgeArticle } from '../domain/knowledge-article.js';
import { KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE } from './knowledge-queues.js';
import type { RequestSecurityContext } from './dtos.js';
import type { KnowledgeDocumentRepository } from './ports/knowledge-document-repository.js';
import type { KnowledgeDocumentStoragePort } from './ports/knowledge-document-storage-port.js';
import { publishAndEnqueue } from './use-cases/register-knowledge-document-use-case.js';

export class SyncPublishedArticleIndex {
  constructor(
    private readonly documents: KnowledgeDocumentRepository,
    private readonly storage: KnowledgeDocumentStoragePort,
    private readonly eventBus: EventBus,
    private readonly queue: QueuePort,
  ) {}

  async upsert(input: {
    readonly article: KnowledgeArticle;
    readonly actorId: string;
    readonly now: Date;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const article = input.article;
    const existingId = article.indexedDocumentId;
    if (existingId) {
      const existing = await this.documents.findById(
        article.organizationId,
        createKnowledgeDocumentId(existingId),
      );
      if (existing) {
        existing.replaceEditorialContent({
          title: article.title,
          articleText: publishedBody(article),
          now: input.now,
        });
        existing.startReindex(input.now);
        await this.documents.save(existing);
        await publishAndEnqueue(this.eventBus, this.queue, {
          document: existing,
          actorId: input.actorId,
          now: input.now,
          replacePreviousVersion: true,
          security: input.security,
        });
        return;
      }
    }

    const count = await this.documents.countByTenant(article.organizationId);
    if (count >= MAX_KNOWLEDGE_DOCUMENTS_PER_TENANT) {
      throw new TooManyKnowledgeDocumentsError();
    }

    const document = KnowledgeDocument.create({
      organizationId: article.organizationId,
      kind: 'article',
      title: article.title,
      articleText: publishedBody(article),
      createdByUserId: input.actorId,
      now: input.now,
    });
    document.markProcessing(input.now);
    await this.documents.save(document);
    article.attachIndexedDocument(document.id);
    await publishAndEnqueue(this.eventBus, this.queue, {
      document,
      actorId: input.actorId,
      now: input.now,
      replacePreviousVersion: false,
      security: input.security,
    });
  }

  async remove(input: {
    readonly article: KnowledgeArticle;
    readonly actorId: string;
    readonly now: Date;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const documentId = input.article.indexedDocumentId;
    if (!documentId) {
      return;
    }

    const existing = await this.documents.findById(
      input.article.organizationId,
      createKnowledgeDocumentId(documentId),
    );
    if (existing) {
      if (existing.storageKey) {
        await this.storage.delete(existing.storageKey);
      }
      await this.documents.delete(input.article.organizationId, existing.id);
      await this.eventBus.publish(
        new KnowledgeDocumentRemovedEvent(
          crypto.randomUUID(),
          input.now,
          input.article.organizationId,
          existing.id,
          input.actorId,
          input.security.correlationId,
        ),
      );
      await this.queue.enqueue(KNOWLEDGE_DOCUMENT_DELETE_INDEX_QUEUE, {
        tenantId: input.article.organizationId,
        documentId: existing.id,
        requestId: input.security.requestId,
        correlationId: input.security.correlationId ?? input.security.requestId,
      });
    }
    input.article.clearIndexedDocument();
  }
}

function publishedBody(article: KnowledgeArticle): string {
  const summary = article.summary ? `${article.summary}\n\n` : '';
  return `${summary}${article.body}`;
}
