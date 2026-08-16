import {
  KNOWLEDGE_ARTICLE_STATUSES,
  type KnowledgeArticleStatus,
} from '@ai-customer-support/contracts';
import { InvalidKnowledgeArticleError } from './errors.js';

export { KNOWLEDGE_ARTICLE_STATUSES, type KnowledgeArticleStatus };

export const MAX_KNOWLEDGE_ARTICLES_PER_TENANT = 500;
export const MAX_KNOWLEDGE_CATEGORIES_PER_TENANT = 50;
export const MAX_ARTICLE_TITLE = 200;
export const MAX_ARTICLE_SLUG = 80;
export const MAX_ARTICLE_SUMMARY = 400;
export const MAX_ARTICLE_BODY = 200_000;
export const MAX_TAGS_PER_ARTICLE = 12;
export const MAX_CATEGORY_NAME = 80;
export const MAX_CATEGORY_DESCRIPTION = 400;
export const ARTICLE_EXCERPT_LENGTH = 180;

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function parseKnowledgeArticleStatus(value: string): KnowledgeArticleStatus {
  if ((KNOWLEDGE_ARTICLE_STATUSES as readonly string[]).includes(value)) {
    return value as KnowledgeArticleStatus;
  }
  throw new InvalidKnowledgeArticleError('Article status is invalid');
}

export function slugifyKnowledgeTitle(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ARTICLE_SLUG);
  if (!slug) {
    throw new InvalidKnowledgeArticleError('Enter a title that can become a URL slug');
  }
  return slug;
}

export function normalizeKnowledgeSlug(raw: string | undefined, fallbackTitle: string): string {
  const source = raw?.trim() ? raw : fallbackTitle;
  return slugifyKnowledgeTitle(source);
}

export function parseKnowledgeTags(raw: readonly string[] | undefined): string[] {
  if (!raw || raw.length === 0) {
    return [];
  }
  if (raw.length > MAX_TAGS_PER_ARTICLE) {
    throw new InvalidKnowledgeArticleError(`Articles can have at most ${MAX_TAGS_PER_ARTICLE} tags`);
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    const tag = item.trim().toLowerCase();
    if (!TAG_PATTERN.test(tag)) {
      throw new InvalidKnowledgeArticleError(
        'Tags must be 1–32 characters using lowercase letters, numbers, and hyphens',
      );
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

export function excerptFromBody(body: string, summary?: string): string {
  const source = summary?.trim() || body.trim().replace(/\s+/g, ' ');
  if (source.length <= ARTICLE_EXCERPT_LENGTH) {
    return source;
  }
  return `${source.slice(0, ARTICLE_EXCERPT_LENGTH).trimEnd()}…`;
}
