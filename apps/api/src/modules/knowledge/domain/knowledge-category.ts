import { InvalidKnowledgeCategoryError } from './errors.js';
import { createKnowledgeCategoryId, type KnowledgeCategoryId } from './knowledge-category-id.js';
import {
  MAX_ARTICLE_SLUG,
  MAX_CATEGORY_DESCRIPTION,
  MAX_CATEGORY_NAME,
  slugifyKnowledgeTitle,
} from './knowledge-article-constants.js';

export type KnowledgeCategorySnapshot = {
  readonly id: KnowledgeCategoryId;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class KnowledgeCategory {
  private constructor(
    readonly id: KnowledgeCategoryId,
    readonly organizationId: string,
    private nameValue: string,
    private slugValue: string,
    private descriptionValue: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  get name(): string {
    return this.nameValue;
  }

  get slug(): string {
    return this.slugValue;
  }

  get description(): string | undefined {
    return this.descriptionValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly now: Date;
    readonly slug?: string;
    readonly description?: string;
    readonly id?: KnowledgeCategoryId;
  }): KnowledgeCategory {
    const name = normalizeCategoryName(input.name);
    const slug = normalizeCategorySlug(input.slug, name);
    return new KnowledgeCategory(
      input.id ?? createKnowledgeCategoryId(),
      input.organizationId,
      name,
      slug,
      normalizeCategoryDescription(input.description),
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: KnowledgeCategorySnapshot): KnowledgeCategory {
    return new KnowledgeCategory(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.slug,
      snapshot.description,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  update(input: {
    readonly now: Date;
    readonly name?: string;
    readonly slug?: string;
    readonly description?: string | null;
  }): void {
    if (input.name !== undefined) {
      this.nameValue = normalizeCategoryName(input.name);
    }
    if (input.slug !== undefined) {
      this.slugValue = normalizeCategorySlug(input.slug, this.nameValue);
    }
    if (input.description !== undefined) {
      this.descriptionValue = normalizeCategoryDescription(input.description ?? undefined);
    }
    this.updatedAtValue = input.now;
  }

  toSnapshot(): KnowledgeCategorySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.nameValue,
      slug: this.slugValue,
      description: this.descriptionValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeCategoryName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_CATEGORY_NAME) {
    throw new InvalidKnowledgeCategoryError(`Name must be between 1 and ${MAX_CATEGORY_NAME} characters`);
  }
  return name;
}

function normalizeCategorySlug(raw: string | undefined, fallbackName: string): string {
  const source = raw?.trim() ? raw : fallbackName;
  const slug = slugifyKnowledgeTitle(source).slice(0, MAX_ARTICLE_SLUG);
  if (!slug) {
    throw new InvalidKnowledgeCategoryError('Enter a name that can become a URL slug');
  }
  return slug;
}

function normalizeCategoryDescription(raw: string | undefined): string | undefined {
  const description = raw?.trim();
  if (!description) {
    return undefined;
  }
  if (description.length > MAX_CATEGORY_DESCRIPTION) {
    throw new InvalidKnowledgeCategoryError(
      `Description must be at most ${MAX_CATEGORY_DESCRIPTION} characters`,
    );
  }
  return description;
}
