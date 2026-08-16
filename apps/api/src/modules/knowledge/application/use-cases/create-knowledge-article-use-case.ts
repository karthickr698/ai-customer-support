import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeArticleCreatedEvent } from '../../domain/events.js';
import { KnowledgeArticle } from '../../domain/knowledge-article.js';
import {
  KnowledgeArticleSlugConflictError,
  KnowledgeCategoryNotFoundError,
  TooManyKnowledgeArticlesError,
} from '../../domain/errors.js';
import { MAX_KNOWLEDGE_ARTICLES_PER_TENANT } from '../../domain/knowledge-article-constants.js';
import { createKnowledgeCategoryId } from '../../domain/knowledge-category-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeArticleDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { KnowledgeCategoryRepository } from '../ports/knowledge-category-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class CreateKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly title: string;
    readonly slug?: string;
    readonly summary?: string;
    readonly body?: string;
    readonly categoryId?: string;
    readonly tags?: readonly string[];
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const count = await this.articles.countByTenant(actor.tenantId);
    if (count >= MAX_KNOWLEDGE_ARTICLES_PER_TENANT) {
      throw new TooManyKnowledgeArticlesError();
    }

    const categoryName = await this.resolveCategory(actor.tenantId, input.categoryId);
    const article = KnowledgeArticle.create({
      organizationId: actor.tenantId,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      body: input.body,
      categoryId: input.categoryId,
      tags: input.tags,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    const conflict = await this.articles.findBySlug(actor.tenantId, article.slug);
    if (conflict) {
      throw new KnowledgeArticleSlugConflictError();
    }
    await this.articles.save(article);
    await this.eventBus.publish(
      new KnowledgeArticleCreatedEvent(
        crypto.randomUUID(),
        article.createdAt,
        actor.tenantId,
        article.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { article: toKnowledgeArticleDto(article, categoryName) };
  }

  private async resolveCategory(tenantId: string, categoryId?: string): Promise<string | null> {
    if (!categoryId) {
      return null;
    }
    const category = await this.categories.findById(tenantId, createKnowledgeCategoryId(categoryId));
    if (!category) {
      throw new KnowledgeCategoryNotFoundError();
    }
    return category.name;
  }
}
