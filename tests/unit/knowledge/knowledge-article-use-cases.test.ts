import type { EventBus } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import type { QueuePort } from '../../../apps/api/src/shared/application/ports/queue-port.ts';
import type { ClockPort } from '../../../apps/api/src/modules/knowledge/application/ports/clock-port.ts';
import type { KnowledgeArticleRepository } from '../../../apps/api/src/modules/knowledge/application/ports/knowledge-article-repository.ts';
import type { KnowledgeCategoryRepository } from '../../../apps/api/src/modules/knowledge/application/ports/knowledge-category-repository.ts';
import type { KnowledgeDocumentRepository } from '../../../apps/api/src/modules/knowledge/application/ports/knowledge-document-repository.ts';
import type { KnowledgeDocumentStoragePort } from '../../../apps/api/src/modules/knowledge/application/ports/knowledge-document-storage-port.ts';
import type { TenantAccessPort } from '../../../apps/api/src/modules/knowledge/application/ports/tenant-access-port.ts';
import { SyncPublishedArticleIndex } from '../../../apps/api/src/modules/knowledge/application/sync-published-article-index.ts';
import { CreateKnowledgeArticleUseCase } from '../../../apps/api/src/modules/knowledge/application/use-cases/create-knowledge-article-use-case.ts';
import { PublishKnowledgeArticleUseCase } from '../../../apps/api/src/modules/knowledge/application/use-cases/knowledge-article-lifecycle-use-cases.ts';
import { ListKnowledgeArticlesUseCase } from '../../../apps/api/src/modules/knowledge/application/use-cases/list-knowledge-articles-use-case.ts';
import { KnowledgeArticle } from '../../../apps/api/src/modules/knowledge/domain/knowledge-article.ts';
import type { KnowledgeArticleId } from '../../../apps/api/src/modules/knowledge/domain/knowledge-article-id.ts';
import type { KnowledgeArticleVersion } from '../../../apps/api/src/modules/knowledge/domain/knowledge-article-version.ts';
import { KnowledgeDocument } from '../../../apps/api/src/modules/knowledge/domain/knowledge-document.ts';
import type { KnowledgeDocumentId } from '../../../apps/api/src/modules/knowledge/domain/knowledge-document-id.ts';
import { Permissions } from '../../../apps/api/src/modules/organizations/domain/permissions.ts';

const now = new Date('2026-08-16T12:00:00.000Z');
const tenantId = '11111111-1111-1111-1111-111111111111';

class MemoryArticles implements KnowledgeArticleRepository {
  readonly items = new Map<string, KnowledgeArticle>();
  readonly versions = new Map<string, KnowledgeArticleVersion[]>();

  async findById(_tenantId: string, articleId: KnowledgeArticleId) {
    return this.items.get(articleId) ?? null;
  }

  async findBySlug(_tenantId: string, slug: string, excludeId?: KnowledgeArticleId) {
    return [...this.items.values()].find((item) => item.slug === slug && item.id !== excludeId) ?? null;
  }

  async save(article: KnowledgeArticle) {
    const pending = article.drainPendingVersions();
    this.items.set(article.id, article);
    const existing = this.versions.get(article.id) ?? [];
    this.versions.set(article.id, [...existing, ...pending]);
  }

  async delete(_tenantId: string, articleId: KnowledgeArticleId) {
    this.items.delete(articleId);
  }

  async search() {
    const items = [...this.items.values()];
    return { items, total: items.length, page: 1, pageSize: 20 };
  }

  async countByTenant() {
    return this.items.size;
  }

  async listVersions(_tenantId: string, articleId: KnowledgeArticleId) {
    return this.versions.get(articleId) ?? [];
  }

  async findVersion(_tenantId: string, articleId: KnowledgeArticleId, version: number) {
    return (this.versions.get(articleId) ?? []).find((item) => item.version === version) ?? null;
  }

  async listTags() {
    return [...new Set([...this.items.values()].flatMap((item) => [...item.tags]))];
  }

  async clearCategory() {}
}

class MemoryCategories implements KnowledgeCategoryRepository {
  async findById() {
    return null;
  }
  async findBySlug() {
    return null;
  }
  async save() {}
  async delete() {}
  async listByTenant() {
    return [];
  }
  async countByTenant() {
    return 0;
  }
}

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

class MemoryStorage implements KnowledgeDocumentStoragePort {
  async save() {
    return 'key';
  }
  async read() {
    return { bytes: Buffer.from('') };
  }
  async delete() {}
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
    return { tenantId, actorId: 'user-1', permissions: [Permissions.KNOWLEDGE_MANAGE, Permissions.ORGANIZATION_READ] };
  },
};

const clock: ClockPort = { now: () => now };
const security = { ipAddress: '127.0.0.1', requestId: 'req-1', correlationId: 'corr-1' };

describe('knowledge article use cases', () => {
  it('creates a draft and lists it in search', async () => {
    const articles = new MemoryArticles();
    const create = new CreateKnowledgeArticleUseCase(
      tenantAccess,
      articles,
      new MemoryCategories(),
      clock,
      new MemoryEvents(),
    );
    const created = await create.execute({
      tenantId,
      actorId: 'user-1',
      title: 'Shipping times',
      body: 'Orders ship in two days.',
      tags: ['shipping'],
      security,
    });
    expect(created.article.status).toBe('draft');
    expect(created.article.slug).toBe('shipping-times');

    const list = new ListKnowledgeArticlesUseCase(tenantAccess, articles, new MemoryCategories());
    const result = await list.execute({
      tenantId,
      actorId: 'user-1',
      page: { page: 1, pageSize: 20 },
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.excerpt).toContain('Orders ship');
  });

  it('publishes a draft and enqueues RAG ingestion', async () => {
    const articles = new MemoryArticles();
    const documents = new MemoryDocuments();
    const queue = new MemoryQueue();
    const events = new MemoryEvents();
    const create = new CreateKnowledgeArticleUseCase(
      tenantAccess,
      articles,
      new MemoryCategories(),
      clock,
      events,
    );
    const created = await create.execute({
      tenantId,
      actorId: 'user-1',
      title: 'Return window',
      body: 'Returns are accepted within 30 days.',
      security,
    });
    const publishedIndex = new SyncPublishedArticleIndex(documents, new MemoryStorage(), events, queue);
    const publish = new PublishKnowledgeArticleUseCase(
      tenantAccess,
      articles,
      new MemoryCategories(),
      clock,
      events,
      publishedIndex,
    );
    const result = await publish.execute({
      tenantId,
      actorId: 'user-1',
      articleId: created.article.id,
      security,
    });
    expect(result.article.status).toBe('published');
    expect(result.article.indexedDocumentId).toBeTruthy();
    expect(documents.items.size).toBe(1);
    expect(queue.jobs[0]?.queueName).toBe('knowledge.document.ingest');
    expect(events.events).toContain('KnowledgeArticlePublished');
  });
});
