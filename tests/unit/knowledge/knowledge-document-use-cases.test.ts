import type { EventBus } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import type { QueuePort } from '../../../apps/api/src/shared/application/ports/queue-port.ts';
import type { ClockPort } from '../../../apps/api/src/modules/knowledge/application/ports/clock-port.ts';
import type { KnowledgeDocumentRepository } from '../../../apps/api/src/modules/knowledge/application/ports/knowledge-document-repository.ts';
import type { TenantAccessPort } from '../../../apps/api/src/modules/knowledge/application/ports/tenant-access-port.ts';
import { RegisterKnowledgeDocumentUseCase } from '../../../apps/api/src/modules/knowledge/application/use-cases/register-knowledge-document-use-case.ts';
import { ReindexKnowledgeDocumentUseCase } from '../../../apps/api/src/modules/knowledge/application/use-cases/reindex-knowledge-document-use-case.ts';
import { KnowledgeDocument } from '../../../apps/api/src/modules/knowledge/domain/knowledge-document.ts';
import type { KnowledgeDocumentId } from '../../../apps/api/src/modules/knowledge/domain/knowledge-document-id.ts';
import { Permissions } from '../../../apps/api/src/modules/organizations/domain/permissions.ts';

const now = new Date('2026-08-14T12:00:00.000Z');
const tenantId = '11111111-1111-1111-1111-111111111111';

class MemoryDocuments implements KnowledgeDocumentRepository {
  readonly items = new Map<string, KnowledgeDocument>();

  async findById(_tenantId: string, documentId: KnowledgeDocumentId) {
    return this.items.get(documentId) ?? null;
  }

  async save(document: KnowledgeDocument) {
    this.items.set(document.id, document);
  }

  async delete(_tenantId: string, documentId: KnowledgeDocumentId) {
    this.items.delete(documentId);
  }

  async listByTenant() {
    return [...this.items.values()];
  }

  async listBySource() {
    return [];
  }

  async countByTenant() {
    return this.items.size;
  }
}

class MemoryQueue implements QueuePort {
  readonly jobs: Array<{ queueName: string; payload: unknown }> = [];
  async enqueue<T>(queueName: string, payload: T) {
    this.jobs.push({ queueName, payload });
  }
  process() {}
  async close() {}
}

class MemoryEvents implements EventBus {
  readonly events: string[] = [];
  async publish(event: { eventName: string }) {
    this.events.push(event.eventName);
  }
  subscribe() {}
}

const tenantAccess: TenantAccessPort = {
  async loadActor() {
    return { tenantId, actorId: 'user-1', permissions: [Permissions.KNOWLEDGE_MANAGE] };
  },
};

const clock: ClockPort = { now: () => now };

describe('knowledge document use cases', () => {
  it('registers an article and enqueues ingestion without waiting', async () => {
    const documents = new MemoryDocuments();
    const queue = new MemoryQueue();
    const events = new MemoryEvents();
    const useCase = new RegisterKnowledgeDocumentUseCase(tenantAccess, documents, clock, events, queue);

    const result = await useCase.execute({
      tenantId,
      actorId: 'user-1',
      kind: 'article',
      title: 'Refund policy',
      articleText: 'Refunds take five days.',
      security: { ipAddress: '127.0.0.1', requestId: 'req-1', correlationId: 'corr-1' },
    });

    expect(result.document.status).toBe('processing');
    expect(result.document.version).toBe(1);
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]?.queueName).toBe('knowledge.document.ingest');
    expect(events.events).toContain('KnowledgeDocumentProcessingRequested');
  });

  it('reindexes by incrementing version and replacing the previous index', async () => {
    const documents = new MemoryDocuments();
    const queue = new MemoryQueue();
    const events = new MemoryEvents();
    const created = KnowledgeDocument.create({
      organizationId: tenantId,
      kind: 'url',
      title: 'Help',
      sourceUri: 'https://example.com/help',
      createdByUserId: 'user-1',
      now,
    });
    created.markProcessing(now);
    created.markReady({ now, chunkCount: 2, embeddingModel: 'hash-v1', parser: 'html', checksum: 'a' });
    await documents.save(created);

    const useCase = new ReindexKnowledgeDocumentUseCase(tenantAccess, documents, clock, events, queue);
    const result = await useCase.execute({
      tenantId,
      actorId: 'user-1',
      documentId: created.id,
      security: { ipAddress: '127.0.0.1', requestId: 'req-2', correlationId: 'corr-2' },
    });

    expect(result.document.version).toBe(2);
    expect(result.document.status).toBe('processing');
    expect((queue.jobs[0]?.payload as { replacePreviousVersion: boolean }).replacePreviousVersion).toBe(true);
  });
});
