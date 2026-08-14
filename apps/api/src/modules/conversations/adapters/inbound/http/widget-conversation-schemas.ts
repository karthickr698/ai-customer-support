import { z } from 'zod';

export const widgetConversationBodySchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(10_000).optional(),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
});

export const widgetMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(10_000).optional(),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
});

export const widgetStatusBodySchema = z.object({
  status: z.enum(['open', 'resolved', 'closed']),
});
