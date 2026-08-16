import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeArticleNotFoundError, KnowledgeArticleSlugConflictError, KnowledgeCategoryNotFoundError } from '../../domain/errors.js';
import { createKnowledgeArticleId } from '../../domain/knowledge-article-id.js';
import { createKnowledgeCategoryId } from '../../domain/knowledge-category-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeArticleDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { KnowledgeCategoryRepository } from '../ports/knowledge-category-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { SyncPublishedArticleIndex } from '../sync-published-article-index.js';

export class UpdateKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
    private readonly publishedIndex: SyncPublishedArticleIndex,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
    readonly title?: string;
    readonly slug?: string;
    readonly summary?: string | null;
    readonly body?: string;
    readonly categoryId?: string | null;
    readonly tags?: readonly string[];
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const article = await this.articles.findById(actor.tenantId, createKnowledgeArticleId(input.articleId));
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }

    const categoryName = await this.resolveCategory(actor.tenantId, input.categoryId, article.categoryId);
    const now = this.clock.now();
    const changed = article.updateContent({
      actorId: actor.actorId,
      now,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      body: input.body,
      categoryId: input.categoryId,
      tags: input.tags,
    });
    const conflict = await this.articles.findBySlug(actor.tenantId, article.slug, article.id);
    if (conflict) {
      throw new KnowledgeArticleSlugConflictError();
    }
    if (changed && article.status === 'published') {
      await this.publishedIndex.upsert({
        article,
        actorId: actor.actorId,
        now,
        security: input.security,
      });
    }
    await this.articles.save(article);
    return { article: toKnowledgeArticleDto(article, categoryName) };
  }

  private async resolveCategory(
    tenantId: string,
    nextCategoryId: string | null | undefined,
    currentCategoryId: string | undefined,
  ): Promise<string | null> {
    const categoryId = nextCategoryId === undefined ? currentCategoryId : (nextCategoryId ?? undefined);
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
