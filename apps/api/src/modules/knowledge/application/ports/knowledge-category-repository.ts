import type { KnowledgeCategory } from '../../domain/knowledge-category.js';
import type { KnowledgeCategoryId } from '../../domain/knowledge-category-id.js';

export type KnowledgeCategoryWithCount = {
  readonly category: KnowledgeCategory;
  readonly articleCount: number;
};

export interface KnowledgeCategoryRepository {
  findById(tenantId: string, categoryId: KnowledgeCategoryId): Promise<KnowledgeCategory | null>;
  findBySlug(tenantId: string, slug: string, excludeId?: KnowledgeCategoryId): Promise<KnowledgeCategory | null>;
  save(category: KnowledgeCategory): Promise<void>;
  delete(tenantId: string, categoryId: KnowledgeCategoryId): Promise<void>;
  listByTenant(tenantId: string): Promise<KnowledgeCategoryWithCount[]>;
  countByTenant(tenantId: string): Promise<number>;
}
