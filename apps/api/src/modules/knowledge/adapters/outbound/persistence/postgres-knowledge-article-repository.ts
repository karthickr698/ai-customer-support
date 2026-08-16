import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  KnowledgeArticleRepository,
  KnowledgeArticleSearch,
} from '../../../application/ports/knowledge-article-repository.js';
import { KnowledgeArticle } from '../../../domain/knowledge-article.js';
import { parseKnowledgeArticleStatus } from '../../../domain/knowledge-article-constants.js';
import { createKnowledgeArticleId, type KnowledgeArticleId } from '../../../domain/knowledge-article-id.js';
import { KnowledgeArticleVersion } from '../../../domain/knowledge-article-version.js';

type ArticleRecord = {
  id: string;
  organizationId: string;
  categoryId: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  status: string;
  tags: string[];
  currentVersion: number;
  publishedVersion: number | null;
  publishedAt: Date | null;
  indexedDocumentId: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

type VersionRecord = {
  id: string;
  articleId: string;
  organizationId: string;
  version: number;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  categoryId: string | null;
  tags: string[];
  status: string;
  createdByUserId: string;
  createdAt: Date;
};

export class PostgresKnowledgeArticleRepository implements KnowledgeArticleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, articleId: KnowledgeArticleId): Promise<KnowledgeArticle | null> {
    const record = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId: tenantId },
    });
    return record ? toArticle(record) : null;
  }

  async findBySlug(
    tenantId: string,
    slug: string,
    excludeId?: KnowledgeArticleId,
  ): Promise<KnowledgeArticle | null> {
    const record = await this.prisma.knowledgeArticle.findFirst({
      where: {
        organizationId: tenantId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return record ? toArticle(record) : null;
  }

  async save(article: KnowledgeArticle): Promise<void> {
    const snapshot = article.toSnapshot();
    const versions = article.drainPendingVersions();
    const data = toArticleRecord(snapshot);
    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeArticle.upsert({
        where: { id: snapshot.id },
        create: data,
        update: {
          categoryId: data.categoryId,
          title: data.title,
          slug: data.slug,
          summary: data.summary,
          body: data.body,
          status: data.status,
          tags: data.tags,
          currentVersion: data.currentVersion,
          publishedVersion: data.publishedVersion,
          publishedAt: data.publishedAt,
          indexedDocumentId: data.indexedDocumentId,
          updatedByUserId: data.updatedByUserId,
          updatedAt: data.updatedAt,
        },
      });
      for (const version of versions) {
        const versionData = toVersionRecord(version.toSnapshot());
        await tx.knowledgeArticleVersion.upsert({
          where: { articleId_version: { articleId: versionData.articleId, version: versionData.version } },
          create: versionData,
          update: {
            title: versionData.title,
            slug: versionData.slug,
            summary: versionData.summary,
            body: versionData.body,
            categoryId: versionData.categoryId,
            tags: versionData.tags,
            status: versionData.status,
          },
        });
      }
    });
  }

  async delete(tenantId: string, articleId: KnowledgeArticleId): Promise<void> {
    await this.prisma.knowledgeArticle.deleteMany({
      where: { id: articleId, organizationId: tenantId },
    });
  }

  async search(filters: KnowledgeArticleSearch, page: PageRequest): Promise<Page<KnowledgeArticle>> {
    const where = toSearchWhere(filters);
    const skip = (page.page - 1) * page.pageSize;
    const [total, records] = await this.prisma.$transaction([
      this.prisma.knowledgeArticle.count({ where }),
      this.prisma.knowledgeArticle.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return {
      items: records.map(toArticle),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.knowledgeArticle.count({ where: { organizationId: tenantId } });
  }

  async listVersions(tenantId: string, articleId: KnowledgeArticleId): Promise<KnowledgeArticleVersion[]> {
    const records = await this.prisma.knowledgeArticleVersion.findMany({
      where: { organizationId: tenantId, articleId },
      orderBy: { version: 'desc' },
    });
    return records.map(toVersion);
  }

  async findVersion(
    tenantId: string,
    articleId: KnowledgeArticleId,
    version: number,
  ): Promise<KnowledgeArticleVersion | null> {
    const record = await this.prisma.knowledgeArticleVersion.findFirst({
      where: { organizationId: tenantId, articleId, version },
    });
    return record ? toVersion(record) : null;
  }

  async listTags(tenantId: string): Promise<string[]> {
    const records = await this.prisma.knowledgeArticle.findMany({
      where: { organizationId: tenantId },
      select: { tags: true },
    });
    const tags = new Set<string>();
    for (const record of records) {
      for (const tag of record.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  }

  async clearCategory(tenantId: string, categoryId: string): Promise<void> {
    await this.prisma.knowledgeArticle.updateMany({
      where: { organizationId: tenantId, categoryId },
      data: { categoryId: null },
    });
  }
}

function toSearchWhere(filters: KnowledgeArticleSearch): Prisma.KnowledgeArticleWhereInput {
  const query = filters.query?.trim();
  return {
    organizationId: filters.tenantId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { summary: { contains: query, mode: 'insensitive' } },
            { body: { contains: query, mode: 'insensitive' } },
            { tags: { has: query.toLowerCase() } },
          ],
        }
      : {}),
  };
}

function toArticle(record: ArticleRecord): KnowledgeArticle {
  return KnowledgeArticle.reconstitute({
    id: createKnowledgeArticleId(record.id),
    organizationId: record.organizationId,
    categoryId: record.categoryId ?? undefined,
    title: record.title,
    slug: record.slug,
    summary: record.summary ?? undefined,
    body: record.body,
    status: parseKnowledgeArticleStatus(record.status),
    tags: record.tags,
    currentVersion: record.currentVersion,
    publishedVersion: record.publishedVersion ?? undefined,
    publishedAt: record.publishedAt ?? undefined,
    indexedDocumentId: record.indexedDocumentId ?? undefined,
    createdByUserId: record.createdByUserId,
    updatedByUserId: record.updatedByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toVersion(record: VersionRecord): KnowledgeArticleVersion {
  return KnowledgeArticleVersion.reconstitute({
    id: record.id,
    articleId: record.articleId,
    organizationId: record.organizationId,
    version: record.version,
    title: record.title,
    slug: record.slug,
    summary: record.summary ?? undefined,
    body: record.body,
    categoryId: record.categoryId ?? undefined,
    tags: record.tags,
    status: parseKnowledgeArticleStatus(record.status),
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
  });
}

function toArticleRecord(snapshot: ReturnType<KnowledgeArticle['toSnapshot']>): Prisma.KnowledgeArticleUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    categoryId: snapshot.categoryId ?? null,
    title: snapshot.title,
    slug: snapshot.slug,
    summary: snapshot.summary ?? null,
    body: snapshot.body,
    status: snapshot.status,
    tags: [...snapshot.tags],
    currentVersion: snapshot.currentVersion,
    publishedVersion: snapshot.publishedVersion ?? null,
    publishedAt: snapshot.publishedAt ?? null,
    indexedDocumentId: snapshot.indexedDocumentId ?? null,
    createdByUserId: snapshot.createdByUserId,
    updatedByUserId: snapshot.updatedByUserId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toVersionRecord(
  snapshot: ReturnType<KnowledgeArticleVersion['toSnapshot']>,
): Prisma.KnowledgeArticleVersionUncheckedCreateInput {
  return {
    id: snapshot.id,
    articleId: snapshot.articleId,
    organizationId: snapshot.organizationId,
    version: snapshot.version,
    title: snapshot.title,
    slug: snapshot.slug,
    summary: snapshot.summary ?? null,
    body: snapshot.body,
    categoryId: snapshot.categoryId ?? null,
    tags: [...snapshot.tags],
    status: snapshot.status,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt,
  };
}
