import type { KnowledgeArticleListResponse, KnowledgeArticleResponse, KnowledgeTagListResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgeArticleNotFoundError } from '../../domain/errors.js';
import type { KnowledgeArticleStatus } from '../../domain/knowledge-article-constants.js';
import { createKnowledgeArticleId } from '../../domain/knowledge-article-id.js';
import { createKnowledgeCategoryId } from '../../domain/knowledge-category-id.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { toKnowledgeArticleDto, toKnowledgeArticleListItemDto } from '../dtos.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { KnowledgeCategoryRepository } from '../ports/knowledge-category-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class ListKnowledgeArticlesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly query?: string;
    readonly status?: KnowledgeArticleStatus;
    readonly categoryId?: string;
    readonly tag?: string;
  }): Promise<KnowledgeArticleListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const result = await this.articles.search(
      {
        tenantId: actor.tenantId,
        query: input.query,
        status: input.status,
        categoryId: input.categoryId,
        tag: input.tag,
      },
      input.page,
    );
    const names = await categoryNameMap(this.categories, actor.tenantId);
    return {
      items: result.items.map((article) =>
        toKnowledgeArticleListItemDto(article, article.categoryId ? names.get(article.categoryId) ?? null : null),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class GetKnowledgeArticleUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
    private readonly categories: KnowledgeCategoryRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly articleId: string;
  }): Promise<KnowledgeArticleResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const article = await this.articles.findById(actor.tenantId, createKnowledgeArticleId(input.articleId));
    if (!article) {
      throw new KnowledgeArticleNotFoundError();
    }
    const categoryName = article.categoryId
      ? (await this.categories.findById(actor.tenantId, createKnowledgeCategoryId(article.categoryId)))?.name ?? null
      : null;
    return { article: toKnowledgeArticleDto(article, categoryName) };
  }
}

export class ListKnowledgeTagsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly articles: KnowledgeArticleRepository,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }): Promise<KnowledgeTagListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const items = await this.articles.listTags(actor.tenantId);
    return { items };
  }
}

async function categoryNameMap(
  categories: KnowledgeCategoryRepository,
  tenantId: string,
): Promise<Map<string, string>> {
  const listed = await categories.listByTenant(tenantId);
  return new Map(listed.map((item) => [item.category.id, item.category.name]));
}
