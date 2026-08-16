import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { KnowledgeArticle } from '../../domain/knowledge-article.js';
import type { KnowledgeArticleId } from '../../domain/knowledge-article-id.js';
import type { KnowledgeArticleVersion } from '../../domain/knowledge-article-version.js';
import type { KnowledgeArticleStatus } from '../../domain/knowledge-article-constants.js';

export type KnowledgeArticleSearch = {
  readonly tenantId: string;
  readonly query?: string;
  readonly status?: KnowledgeArticleStatus;
  readonly categoryId?: string;
  readonly tag?: string;
};

export interface KnowledgeArticleRepository {
  findById(tenantId: string, articleId: KnowledgeArticleId): Promise<KnowledgeArticle | null>;
  findBySlug(tenantId: string, slug: string, excludeId?: KnowledgeArticleId): Promise<KnowledgeArticle | null>;
  save(article: KnowledgeArticle): Promise<void>;
  delete(tenantId: string, articleId: KnowledgeArticleId): Promise<void>;
  search(filters: KnowledgeArticleSearch, page: PageRequest): Promise<Page<KnowledgeArticle>>;
  countByTenant(tenantId: string): Promise<number>;
  listVersions(tenantId: string, articleId: KnowledgeArticleId): Promise<KnowledgeArticleVersion[]>;
  findVersion(
    tenantId: string,
    articleId: KnowledgeArticleId,
    version: number,
  ): Promise<KnowledgeArticleVersion | null>;
  listTags(tenantId: string): Promise<string[]>;
  clearCategory(tenantId: string, categoryId: string): Promise<void>;
}
