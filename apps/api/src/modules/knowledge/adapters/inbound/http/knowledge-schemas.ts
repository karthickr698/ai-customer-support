import { KNOWLEDGE_SOURCE_TYPES } from '@ai-customer-support/contracts';
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
