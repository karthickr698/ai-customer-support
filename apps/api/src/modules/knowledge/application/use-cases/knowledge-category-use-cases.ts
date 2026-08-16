import { Permissions } from '../../../organizations/domain/permissions.js';
import { KnowledgePolicy } from '../../domain/knowledge-policy.js';
import { KnowledgeCategory } from '../../domain/knowledge-category.js';
import { createKnowledgeCategoryId } from '../../domain/knowledge-category-id.js';
import {
  KnowledgeCategoryNotFoundError,
  KnowledgeCategorySlugConflictError,
  TooManyKnowledgeCategoriesError,
} from '../../domain/errors.js';
import { MAX_KNOWLEDGE_CATEGORIES_PER_TENANT } from '../../domain/knowledge-article-constants.js';
import { toKnowledgeCategoryDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { KnowledgeArticleRepository } from '../ports/knowledge-article-repository.js';
import type { KnowledgeCategoryRepository } from '../ports/knowledge-category-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class ListKnowledgeCategoriesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly categories: KnowledgeCategoryRepository,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const items = await this.categories.listByTenant(actor.tenantId);
    return { items: items.map((item) => toKnowledgeCategoryDto(item.category, item.articleCount)) };
  }
}

export class CreateKnowledgeCategoryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly slug?: string;
    readonly description?: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);

    const count = await this.categories.countByTenant(actor.tenantId);
    if (count >= MAX_KNOWLEDGE_CATEGORIES_PER_TENANT) {
      throw new TooManyKnowledgeCategoriesError();
    }

    const category = KnowledgeCategory.create({
      organizationId: actor.tenantId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      now: this.clock.now(),
    });
    const existing = await this.categories.findBySlug(actor.tenantId, category.slug);
    if (existing) {
      throw new KnowledgeCategorySlugConflictError();
    }
    await this.categories.save(category);
    return { category: toKnowledgeCategoryDto(category, 0) };
  }
}

export class UpdateKnowledgeCategoryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly categoryId: string;
    readonly name?: string;
    readonly slug?: string;
    readonly description?: string | null;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const category = await this.categories.findById(actor.tenantId, createKnowledgeCategoryId(input.categoryId));
    if (!category) {
      throw new KnowledgeCategoryNotFoundError();
    }
    category.update({
      now: this.clock.now(),
      name: input.name,
      slug: input.slug,
      description: input.description,
    });
    const conflict = await this.categories.findBySlug(actor.tenantId, category.slug, category.id);
    if (conflict) {
      throw new KnowledgeCategorySlugConflictError();
    }
    await this.categories.save(category);
    const listed = await this.categories.listByTenant(actor.tenantId);
    const count = listed.find((item) => item.category.id === category.id)?.articleCount ?? 0;
    return { category: toKnowledgeCategoryDto(category, count) };
  }
}

export class DeleteKnowledgeCategoryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly categories: KnowledgeCategoryRepository,
    private readonly articles: KnowledgeArticleRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly categoryId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    KnowledgePolicy.assertPermission(actor.permissions, Permissions.KNOWLEDGE_MANAGE);
    const categoryId = createKnowledgeCategoryId(input.categoryId);
    const existing = await this.categories.findById(actor.tenantId, categoryId);
    if (!existing) {
      throw new KnowledgeCategoryNotFoundError();
    }
    await this.articles.clearCategory(actor.tenantId, existing.id);
    await this.categories.delete(actor.tenantId, categoryId);
  }
}
