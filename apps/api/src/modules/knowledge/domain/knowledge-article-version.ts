import type { KnowledgeArticleStatus } from '@ai-customer-support/contracts';

export type KnowledgeArticleVersionSnapshot = {
  readonly id: string;
  readonly articleId: string;
  readonly organizationId: string;
  readonly version: number;
  readonly title: string;
  readonly slug: string;
  readonly summary?: string;
  readonly body: string;
  readonly categoryId?: string;
  readonly tags: readonly string[];
  readonly status: KnowledgeArticleStatus;
  readonly createdByUserId: string;
  readonly createdAt: Date;
};

export class KnowledgeArticleVersion {
  private constructor(
    readonly id: string,
    readonly articleId: string,
    readonly organizationId: string,
    readonly version: number,
    readonly title: string,
    readonly slug: string,
    readonly summary: string | undefined,
    readonly body: string,
    readonly categoryId: string | undefined,
    readonly tags: readonly string[],
    readonly status: KnowledgeArticleStatus,
    readonly createdByUserId: string,
    readonly createdAt: Date,
  ) {}

  static create(input: Omit<KnowledgeArticleVersionSnapshot, 'id'> & { readonly id?: string }): KnowledgeArticleVersion {
    return new KnowledgeArticleVersion(
      input.id ?? crypto.randomUUID(),
      input.articleId,
      input.organizationId,
      input.version,
      input.title,
      input.slug,
      input.summary,
      input.body,
      input.categoryId,
      [...input.tags],
      input.status,
      input.createdByUserId,
      input.createdAt,
    );
  }

  static reconstitute(snapshot: KnowledgeArticleVersionSnapshot): KnowledgeArticleVersion {
    return KnowledgeArticleVersion.create(snapshot);
  }

  toSnapshot(): KnowledgeArticleVersionSnapshot {
    return {
      id: this.id,
      articleId: this.articleId,
      organizationId: this.organizationId,
      version: this.version,
      title: this.title,
      slug: this.slug,
      summary: this.summary,
      body: this.body,
      categoryId: this.categoryId,
      tags: this.tags,
      status: this.status,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
    };
  }
}
