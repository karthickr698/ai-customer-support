import type { KnowledgeArticleStatus } from '@ai-customer-support/contracts';
import {
  InvalidKnowledgeArticleError,
  InvalidKnowledgeArticleStateError,
} from './errors.js';
import { createKnowledgeArticleId, type KnowledgeArticleId } from './knowledge-article-id.js';
import {
  MAX_ARTICLE_BODY,
  MAX_ARTICLE_SUMMARY,
  MAX_ARTICLE_TITLE,
  normalizeKnowledgeSlug,
  parseKnowledgeTags,
} from './knowledge-article-constants.js';
import { KnowledgeArticleVersion } from './knowledge-article-version.js';

export type KnowledgeArticleSnapshot = {
  readonly id: KnowledgeArticleId;
  readonly organizationId: string;
  readonly categoryId?: string;
  readonly title: string;
  readonly slug: string;
  readonly summary?: string;
  readonly body: string;
  readonly status: KnowledgeArticleStatus;
  readonly tags: readonly string[];
  readonly currentVersion: number;
  readonly publishedVersion?: number;
  readonly publishedAt?: Date;
  readonly indexedDocumentId?: string;
  readonly createdByUserId: string;
  readonly updatedByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class KnowledgeArticle {
  private pendingVersions: KnowledgeArticleVersion[] = [];

  private constructor(
    readonly id: KnowledgeArticleId,
    readonly organizationId: string,
    private categoryIdValue: string | undefined,
    private titleValue: string,
    private slugValue: string,
    private summaryValue: string | undefined,
    private bodyValue: string,
    private statusValue: KnowledgeArticleStatus,
    private tagsValue: string[],
    private currentVersionValue: number,
    private publishedVersionValue: number | undefined,
    private publishedAtValue: Date | undefined,
    private indexedDocumentIdValue: string | undefined,
    readonly createdByUserId: string,
    private updatedByUserIdValue: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  get categoryId(): string | undefined {
    return this.categoryIdValue;
  }

  get title(): string {
    return this.titleValue;
  }

  get slug(): string {
    return this.slugValue;
  }

  get summary(): string | undefined {
    return this.summaryValue;
  }

  get body(): string {
    return this.bodyValue;
  }

  get status(): KnowledgeArticleStatus {
    return this.statusValue;
  }

  get tags(): readonly string[] {
    return this.tagsValue;
  }

  get currentVersion(): number {
    return this.currentVersionValue;
  }

  get publishedVersion(): number | undefined {
    return this.publishedVersionValue;
  }

  get publishedAt(): Date | undefined {
    return this.publishedAtValue;
  }

  get indexedDocumentId(): string | undefined {
    return this.indexedDocumentIdValue;
  }

  get updatedByUserId(): string {
    return this.updatedByUserIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  static create(input: {
    readonly organizationId: string;
    readonly title: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly slug?: string;
    readonly summary?: string;
    readonly body?: string;
    readonly categoryId?: string;
    readonly tags?: readonly string[];
    readonly id?: KnowledgeArticleId;
  }): KnowledgeArticle {
    const title = normalizeTitle(input.title);
    const article = new KnowledgeArticle(
      input.id ?? createKnowledgeArticleId(),
      input.organizationId,
      input.categoryId,
      title,
      normalizeKnowledgeSlug(input.slug, title),
      normalizeSummary(input.summary),
      normalizeBody(input.body, false),
      'draft',
      parseKnowledgeTags(input.tags),
      1,
      undefined,
      undefined,
      undefined,
      input.createdByUserId,
      input.createdByUserId,
      input.now,
      input.now,
    );
    article.recordVersion(input.createdByUserId, input.now);
    return article;
  }

  static reconstitute(snapshot: KnowledgeArticleSnapshot): KnowledgeArticle {
    return new KnowledgeArticle(
      snapshot.id,
      snapshot.organizationId,
      snapshot.categoryId,
      snapshot.title,
      snapshot.slug,
      snapshot.summary,
      snapshot.body,
      snapshot.status,
      [...snapshot.tags],
      snapshot.currentVersion,
      snapshot.publishedVersion,
      snapshot.publishedAt,
      snapshot.indexedDocumentId,
      snapshot.createdByUserId,
      snapshot.updatedByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  updateContent(input: {
    readonly actorId: string;
    readonly now: Date;
    readonly title?: string;
    readonly slug?: string;
    readonly summary?: string | null;
    readonly body?: string;
    readonly categoryId?: string | null;
    readonly tags?: readonly string[];
  }): boolean {
    if (this.statusValue === 'archived') {
      throw new InvalidKnowledgeArticleStateError('Archived articles cannot be edited');
    }

    const nextTitle = input.title !== undefined ? normalizeTitle(input.title) : this.titleValue;
    const nextSlug =
      input.slug !== undefined ? normalizeKnowledgeSlug(input.slug, nextTitle) : this.slugValue;
    const nextSummary =
      input.summary === undefined ? this.summaryValue : normalizeSummary(input.summary ?? undefined);
    const nextBody = input.body !== undefined ? normalizeBody(input.body, false) : this.bodyValue;
    const nextCategoryId =
      input.categoryId === undefined ? this.categoryIdValue : (input.categoryId ?? undefined);
    const nextTags = input.tags !== undefined ? parseKnowledgeTags(input.tags) : this.tagsValue;

    const changed =
      nextTitle !== this.titleValue ||
      nextSlug !== this.slugValue ||
      nextSummary !== this.summaryValue ||
      nextBody !== this.bodyValue ||
      nextCategoryId !== this.categoryIdValue ||
      nextTags.join(',') !== this.tagsValue.join(',');

    if (!changed) {
      return false;
    }

    this.titleValue = nextTitle;
    this.slugValue = nextSlug;
    this.summaryValue = nextSummary;
    this.bodyValue = nextBody;
    this.categoryIdValue = nextCategoryId;
    this.tagsValue = nextTags;
    this.currentVersionValue += 1;
    this.updatedByUserIdValue = input.actorId;
    this.updatedAtValue = input.now;
    this.recordVersion(input.actorId, input.now);
    return true;
  }

  publish(now: Date, actorId: string): void {
    if (this.statusValue === 'archived') {
      throw new InvalidKnowledgeArticleStateError('Archived articles cannot be published');
    }
    normalizeBody(this.bodyValue, true);
    this.statusValue = 'published';
    this.publishedVersionValue = this.currentVersionValue;
    this.publishedAtValue = now;
    this.updatedByUserIdValue = actorId;
    this.updatedAtValue = now;
  }

  unpublish(now: Date, actorId: string): void {
    if (this.statusValue !== 'published') {
      throw new InvalidKnowledgeArticleStateError('Only published articles can be unpublished');
    }
    this.statusValue = 'draft';
    this.publishedAtValue = undefined;
    this.updatedByUserIdValue = actorId;
    this.updatedAtValue = now;
  }

  archive(now: Date, actorId: string): void {
    if (this.statusValue === 'archived') {
      throw new InvalidKnowledgeArticleStateError('This article is already archived');
    }
    this.statusValue = 'archived';
    this.publishedAtValue = undefined;
    this.updatedByUserIdValue = actorId;
    this.updatedAtValue = now;
  }

  restoreVersion(version: KnowledgeArticleVersion, now: Date, actorId: string): void {
    if (version.articleId !== this.id) {
      throw new InvalidKnowledgeArticleError('Version does not belong to this article');
    }
    if (this.statusValue === 'archived') {
      this.statusValue = 'draft';
    }
    this.updateContent({
      actorId,
      now,
      title: version.title,
      slug: version.slug,
      summary: version.summary ?? null,
      body: version.body,
      categoryId: version.categoryId ?? null,
      tags: version.tags,
    });
  }

  attachIndexedDocument(documentId: string): void {
    this.indexedDocumentIdValue = documentId;
  }

  clearIndexedDocument(): void {
    this.indexedDocumentIdValue = undefined;
  }

  drainPendingVersions(): KnowledgeArticleVersion[] {
    const versions = this.pendingVersions;
    this.pendingVersions = [];
    return versions;
  }

  toSnapshot(): KnowledgeArticleSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      categoryId: this.categoryIdValue,
      title: this.titleValue,
      slug: this.slugValue,
      summary: this.summaryValue,
      body: this.bodyValue,
      status: this.statusValue,
      tags: this.tagsValue,
      currentVersion: this.currentVersionValue,
      publishedVersion: this.publishedVersionValue,
      publishedAt: this.publishedAtValue,
      indexedDocumentId: this.indexedDocumentIdValue,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserIdValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }

  private recordVersion(actorId: string, now: Date): void {
    this.pendingVersions.push(
      KnowledgeArticleVersion.create({
        articleId: this.id,
        organizationId: this.organizationId,
        version: this.currentVersionValue,
        title: this.titleValue,
        slug: this.slugValue,
        summary: this.summaryValue,
        body: this.bodyValue,
        categoryId: this.categoryIdValue,
        tags: this.tagsValue,
        status: this.statusValue,
        createdByUserId: actorId,
        createdAt: now,
      }),
    );
  }
}

function normalizeTitle(raw: string): string {
  const title = raw.trim();
  if (title.length < 1 || title.length > MAX_ARTICLE_TITLE) {
    throw new InvalidKnowledgeArticleError(`Title must be between 1 and ${MAX_ARTICLE_TITLE} characters`);
  }
  return title;
}

function normalizeSummary(raw: string | undefined): string | undefined {
  const summary = raw?.trim();
  if (!summary) {
    return undefined;
  }
  if (summary.length > MAX_ARTICLE_SUMMARY) {
    throw new InvalidKnowledgeArticleError(`Summary must be at most ${MAX_ARTICLE_SUMMARY} characters`);
  }
  return summary;
}

function normalizeBody(raw: string | undefined, required: boolean): string {
  const body = raw?.trim() ?? '';
  if (required && body.length < 1) {
    throw new InvalidKnowledgeArticleError('Article body is required to publish');
  }
  if (body.length > MAX_ARTICLE_BODY) {
    throw new InvalidKnowledgeArticleError('Article body is too long');
  }
  return body;
}
