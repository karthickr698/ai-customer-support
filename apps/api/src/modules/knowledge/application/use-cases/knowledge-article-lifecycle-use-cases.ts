import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  KnowledgeArticleArchivedEvent,
  KnowledgeArticlePublishedEvent,
  KnowledgeArticleUnpublishedEvent,
} from '../../domain/events.js';
import { KnowledgeArticleNotFoundError } from '../../domain/errors.js';
import { createKnowledgeArticleId } from '../../domain/knowledge-article-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeArticleDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { KnowledgeCategoryRepository } from '../ports/knowledge-category-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { SyncPublishedArticleIndex } from '../sync-published-article-index.js';
import { createKnowledgeCategoryId } from '../../domain/knowledge-category-id.js';

export class PublishKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly publishedIndex: SyncPublishedArticleIndex,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const article = await this.articles.findById(actor.tenantId, createKnowledgeArticleId(input.articleId));
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const now = this.clock.now();
    article.publish(now, actor.actorId);
    await this.publishedIndex.upsert({
      article,
      actorId: actor.actorId,
      now,
      security: input.security,
    });
    await this.articles.save(article);
    await this.eventBus.publish(
      new KnowledgeArticlePublishedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        article.id,
        article.currentVersion,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { article: toKnowledgeArticleDto(article, await this.categoryName(actor.tenantId, article.categoryId)) };
  }

  private async categoryName(tenantId: string, categoryId?: string): Promise<string | null> {
    if (!categoryId) {
      return null;
    }
    const category = await this.categories.findById(tenantId, createKnowledgeCategoryId(categoryId));
    return category?.name ?? null;
  }
}

export class UnpublishKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly publishedIndex: SyncPublishedArticleIndex,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const article = await this.articles.findById(actor.tenantId, createKnowledgeArticleId(input.articleId));
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const now = this.clock.now();
    article.unpublish(now, actor.actorId);
    await this.publishedIndex.remove({
      article,
      actorId: actor.actorId,
      now,
      security: input.security,
    });
    await this.articles.save(article);
    await this.eventBus.publish(
      new KnowledgeArticleUnpublishedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        article.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { article: toKnowledgeArticleDto(article, await this.categoryName(actor.tenantId, article.categoryId)) };
  }

  private async categoryName(tenantId: string, categoryId?: string): Promise<string | null> {
    if (!categoryId) {
      return null;
    }
    const category = await this.categories.findById(tenantId, createKnowledgeCategoryId(categoryId));
    return category?.name ?? null;
  }
}

export class ArchiveKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly publishedIndex: SyncPublishedArticleIndex,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const article = await this.articles.findById(actor.tenantId, createKnowledgeArticleId(input.articleId));
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const now = this.clock.now();
    article.archive(now, actor.actorId);
    await this.publishedIndex.remove({
      article,
      actorId: actor.actorId,
      now,
      security: input.security,
    });
    await this.articles.save(article);
    await this.eventBus.publish(
      new KnowledgeArticleArchivedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        article.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { article: toKnowledgeArticleDto(article, await this.categoryName(actor.tenantId, article.categoryId)) };
  }

  private async categoryName(tenantId: string, categoryId?: string): Promise<string | null> {
    if (!categoryId) {
      return null;
    }
    const category = await this.categories.findById(tenantId, createKnowledgeCategoryId(categoryId));
    return category?.name ?? null;
  }
}
