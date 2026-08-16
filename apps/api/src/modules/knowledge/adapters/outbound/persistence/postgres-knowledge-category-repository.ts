import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  KnowledgeCategoryRepository,
  KnowledgeCategoryWithCount,
} from '../../../application/ports/knowledge-category-repository.js';
import { KnowledgeCategory } from '../../../domain/knowledge-category.js';
import { createKnowledgeCategoryId, type KnowledgeCategoryId } from '../../../domain/knowledge-category-id.js';

type CategoryRecord = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresKnowledgeCategoryRepository implements KnowledgeCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, categoryId: KnowledgeCategoryId): Promise<KnowledgeCategory | null> {
    const record = await this.prisma.knowledgeCategory.findFirst({
      where: { id: categoryId, organizationId: tenantId },
    });
    return record ? toCategory(record) : null;
  }

  async findBySlug(
    tenantId: string,
    slug: string,
    excludeId?: KnowledgeCategoryId,
  ): Promise<KnowledgeCategory | null> {
    const record = await this.prisma.knowledgeCategory.findFirst({
      where: {
        organizationId: tenantId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return record ? toCategory(record) : null;
  }

  async save(category: KnowledgeCategory): Promise<void> {
    const snapshot = category.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.knowledgeCategory.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(tenantId: string, categoryId: KnowledgeCategoryId): Promise<void> {
    await this.prisma.knowledgeCategory.deleteMany({
      where: { id: categoryId, organizationId: tenantId },
    });
  }

  async listByTenant(tenantId: string): Promise<KnowledgeCategoryWithCount[]> {
    const records = await this.prisma.knowledgeCategory.findMany({
      where: { organizationId: tenantId },
      include: { _count: { select: { articles: true } } },
      orderBy: { name: 'asc' },
    });
    return records.map((record) => ({
      category: toCategory(record),
      articleCount: record._count.articles,
    }));
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.knowledgeCategory.count({ where: { organizationId: tenantId } });
  }
}

function toCategory(record: CategoryRecord): KnowledgeCategory {
  return KnowledgeCategory.reconstitute({
    id: createKnowledgeCategoryId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    slug: record.slug,
    description: record.description ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toRecord(snapshot: ReturnType<KnowledgeCategory['toSnapshot']>): Prisma.KnowledgeCategoryUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    slug: snapshot.slug,
    description: snapshot.description ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
