import type {
  KnowledgeArticleDto,
  KnowledgeArticleListItemDto,
  KnowledgeArticleVersionDto,
  KnowledgeCategoryDto,
  KnowledgeDocumentDto,
  KnowledgeSourceDto,
} from '@ai-customer-support/contracts';
import type { KnowledgeArticle } from '../domain/knowledge-article.js';
import { excerptFromBody } from '../domain/knowledge-article-constants.js';
import type { KnowledgeArticleVersion } from '../domain/knowledge-article-version.js';
import type { KnowledgeCategory } from '../domain/knowledge-category.js';
import type { KnowledgeDocument } from '../domain/knowledge-document.js';
import type { KnowledgeSource } from '../domain/knowledge-source.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toKnowledgeSourceDto(source: KnowledgeSource): KnowledgeSourceDto {
  const snapshot = source.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    type: snapshot.type,
    name: snapshot.name,
    url: snapshot.url ?? null,
    description: snapshot.description ?? null,
    status: snapshot.status,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toKnowledgeDocumentDto(document: KnowledgeDocument): KnowledgeDocumentDto {
  const snapshot = document.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    sourceId: snapshot.sourceId ?? null,
    kind: snapshot.kind,
    title: snapshot.title,
    sourceUri: snapshot.sourceUri ?? null,
    mediaType: snapshot.mediaType ?? null,
    fileName: snapshot.fileName ?? null,
    checksum: snapshot.checksum ?? null,
    status: snapshot.status,
    version: snapshot.version,
    chunkCount: snapshot.chunkCount,
    embeddingModel: snapshot.embeddingModel ?? null,
    parser: snapshot.parser ?? null,
    failureCode: snapshot.failureCode ?? null,
    failureMessage: snapshot.failureMessage ?? null,
    indexedAt: snapshot.indexedAt?.toISOString() ?? null,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toKnowledgeCategoryDto(
  category: KnowledgeCategory,
  articleCount: number,
): KnowledgeCategoryDto {
  const snapshot = category.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    slug: snapshot.slug,
    description: snapshot.description ?? null,
    articleCount,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toKnowledgeArticleDto(
  article: KnowledgeArticle,
  categoryName?: string | null,
): KnowledgeArticleDto {
  const snapshot = article.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    categoryId: snapshot.categoryId ?? null,
    categoryName: categoryName ?? null,
    title: snapshot.title,
    slug: snapshot.slug,
    summary: snapshot.summary ?? null,
    body: snapshot.body,
    status: snapshot.status,
    tags: snapshot.tags,
    currentVersion: snapshot.currentVersion,
    publishedVersion: snapshot.publishedVersion ?? null,
    publishedAt: snapshot.publishedAt?.toISOString() ?? null,
    indexedDocumentId: snapshot.indexedDocumentId ?? null,
    createdByUserId: snapshot.createdByUserId,
    updatedByUserId: snapshot.updatedByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toKnowledgeArticleListItemDto(
  article: KnowledgeArticle,
  categoryName?: string | null,
): KnowledgeArticleListItemDto {
  const snapshot = article.toSnapshot();
  const dto = toKnowledgeArticleDto(article, categoryName);
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    title: dto.title,
    slug: dto.slug,
    summary: dto.summary,
    status: dto.status,
    tags: dto.tags,
    currentVersion: dto.currentVersion,
    publishedVersion: dto.publishedVersion,
    publishedAt: dto.publishedAt,
    indexedDocumentId: dto.indexedDocumentId,
    createdByUserId: dto.createdByUserId,
    updatedByUserId: dto.updatedByUserId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    excerpt: excerptFromBody(snapshot.body, snapshot.summary),
  };
}

export function toKnowledgeArticleVersionDto(version: KnowledgeArticleVersion): KnowledgeArticleVersionDto {
  const snapshot = version.toSnapshot();
  return {
    id: snapshot.id,
    articleId: snapshot.articleId,
    version: snapshot.version,
    title: snapshot.title,
    slug: snapshot.slug,
    summary: snapshot.summary ?? null,
    body: snapshot.body,
    categoryId: snapshot.categoryId ?? null,
    tags: snapshot.tags,
    status: snapshot.status,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
