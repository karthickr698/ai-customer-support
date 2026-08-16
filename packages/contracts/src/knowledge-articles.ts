/**
 * Cross-runtime DTOs for the editorial knowledge-base (articles, categories, versions).
 * Published articles are indexed for RAG as knowledge documents of kind `article`.
 */

export const KNOWLEDGE_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export type KnowledgeArticleStatus = (typeof KNOWLEDGE_ARTICLE_STATUSES)[number];

export type KnowledgeCategoryDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly articleCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type KnowledgeCategoryResponse = {
  readonly category: KnowledgeCategoryDto;
};

export type KnowledgeCategoryListResponse = {
  readonly items: readonly KnowledgeCategoryDto[];
};

export type CreateKnowledgeCategoryRequest = {
  readonly name: string;
  readonly slug?: string;
  readonly description?: string;
};

export type UpdateKnowledgeCategoryRequest = {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string | null;
};

export type KnowledgeArticleDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly title: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly body: string;
  readonly status: KnowledgeArticleStatus;
  readonly tags: readonly string[];
  readonly currentVersion: number;
  readonly publishedVersion: number | null;
  readonly publishedAt: string | null;
  readonly indexedDocumentId: string | null;
  readonly createdByUserId: string;
  readonly updatedByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type KnowledgeArticleListItemDto = Omit<KnowledgeArticleDto, 'body'> & {
  readonly excerpt: string;
};

export type KnowledgeArticleResponse = {
  readonly article: KnowledgeArticleDto;
};

export type KnowledgeArticleListResponse = {
  readonly items: readonly KnowledgeArticleListItemDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type CreateKnowledgeArticleRequest = {
  readonly title: string;
  readonly slug?: string;
  readonly summary?: string;
  readonly body?: string;
  readonly categoryId?: string;
  readonly tags?: readonly string[];
};

export type UpdateKnowledgeArticleRequest = {
  readonly title?: string;
  readonly slug?: string;
  readonly summary?: string | null;
  readonly body?: string;
  readonly categoryId?: string | null;
  readonly tags?: readonly string[];
};

export type KnowledgeArticleVersionDto = {
  readonly id: string;
  readonly articleId: string;
  readonly version: number;
  readonly title: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly body: string;
  readonly categoryId: string | null;
  readonly tags: readonly string[];
  readonly status: KnowledgeArticleStatus;
  readonly createdByUserId: string;
  readonly createdAt: string;
};

export type KnowledgeArticleVersionListResponse = {
  readonly items: readonly KnowledgeArticleVersionDto[];
};

export type KnowledgeTagListResponse = {
  readonly items: readonly string[];
};

export function isKnowledgeArticleStatus(value: unknown): value is KnowledgeArticleStatus {
  return typeof value === 'string' && (KNOWLEDGE_ARTICLE_STATUSES as readonly string[]).includes(value);
}
