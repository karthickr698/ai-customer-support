import { KNOWLEDGE_DOCUMENT_KINDS, KNOWLEDGE_SOURCE_TYPES } from '@ai-customer-support/contracts';
import { z } from 'zod';

export const registerKnowledgeSourceBodySchema = z
  .object({
    type: z.enum(KNOWLEDGE_SOURCE_TYPES),
    name: z.string().trim().min(1, 'Name is required').max(200),
    url: z.string().trim().url('Enter a valid URL').max(2000).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    const needsUrl = value.type === 'url' || value.type === 'help_center' || value.type === 'sitemap';
    if (needsUrl && !value.url) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'A URL is required for this source type' });
    }
    if (value.type === 'text' && !value.description) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Text knowledge sources require a description',
      });
    }
  });

export const registerKnowledgeDocumentBodySchema = z
  .object({
    kind: z.enum(['url', 'article'] as const),
    title: z.string().trim().min(1, 'Title is required').max(200),
    url: z.string().trim().url('Enter a valid URL').max(2000).optional(),
    articleText: z.string().trim().min(1).max(200_000).optional(),
    sourceId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'url' && !value.url) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'A URL is required' });
    }
    if (value.kind === 'article' && !value.articleText) {
      ctx.addIssue({ code: 'custom', path: ['articleText'], message: 'Article text is required' });
    }
  });

export const uploadKnowledgeDocumentFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  sourceId: z.string().uuid().optional(),
});

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const uuidSchema = z.string().uuid('Enter a valid id');

export const knowledgeArticleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['draft', 'published', 'archived']).optional()),
  categoryId: z.preprocess(emptyToUndefined, uuidSchema.optional()),
  tag: z.preprocess(emptyToUndefined, z.string().trim().max(32).optional()),
});

export const createKnowledgeCategoryBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(400).optional(),
});

export const updateKnowledgeCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(400).nullable().optional(),
});

export const createKnowledgeArticleBodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  slug: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().max(400).optional(),
  body: z.string().max(200_000).optional(),
  categoryId: uuidSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
});

export const updateKnowledgeArticleBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().max(400).nullable().optional(),
  body: z.string().max(200_000).optional(),
  categoryId: uuidSchema.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
});

export const ragPlaygroundBodySchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(10_000),
  topK: z.number().int().min(1).max(20).optional(),
  generate: z.boolean().optional(),
  documentId: z.string().trim().min(1).max(80).optional(),
  filters: z
    .object({
      documentIds: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
      kinds: z.array(z.enum(KNOWLEDGE_DOCUMENT_KINDS)).optional(),
      sourceUri: z.string().trim().min(1).max(2000).optional(),
      titleContains: z.string().trim().min(1).max(200).optional(),
    })
    .optional(),
});
