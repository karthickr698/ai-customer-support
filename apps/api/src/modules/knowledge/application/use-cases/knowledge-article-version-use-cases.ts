import type { KnowledgeArticleVersionListResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeArticleNotFoundError, KnowledgeArticleVersionNotFoundError } from '../../domain/errors.js';
import { createKnowledgeArticleId } from '../../domain/knowledge-article-id.js';
import { createKnowledgeCategoryId } from '../../domain/knowledge-category-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeArticleDto, toKnowledgeArticleVersionDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { KnowledgeCategoryRepository } from '../ports/knowledge-category-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { SyncPublishedArticleIndex } from '../sync-published-article-index.js';

export class ListKnowledgeArticleVersionsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
  }): Promise<KnowledgeArticleVersionListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const articleId = createKnowledgeArticleId(input.articleId);
    const article = await this.articles.findById(actor.tenantId, articleId);
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const items = await this.articles.listVersions(actor.tenantId, articleId);
    return { items: items.map(toKnowledgeArticleVersionDto) };
  }
}

export class RestoreKnowledgeArticleVersionUseCase {
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
    readonly version: number;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const articleId = createKnowledgeArticleId(input.articleId);
    const article = await this.articles.findById(actor.tenantId, articleId);
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const version = await this.articles.findVersion(actor.tenantId, articleId, input.version);
    if (!version) {
      throw new KnowledgeArticleVersionNotFoundError();
    }
    const now = this.clock.now();
    article.restoreVersion(version, now, actor.actorId);
    if (article.status === 'published') {
      await this.publishedIndex.upsert({
        article,
        actorId: actor.actorId,
        now,
        security: input.security,
      });
    }
    await this.articles.save(article);
    const categoryName = article.categoryId
      ? (await this.categories.findById(actor.tenantId, createKnowledgeCategoryId(article.categoryId)))?.name ??
        null
      : null;
    return { article: toKnowledgeArticleDto(article, categoryName) };
  }
}
