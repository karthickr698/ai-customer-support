import { z } from 'zod';

const uuidSchema = z.string().uuid('Enter a valid id');

export const createConversationBodySchema = z.object({
  customerEmail: z
    .string()
    .trim()
    .min(1, 'Customer email is required')
    .email('Enter a valid customer email address')
    .max(254),
  customerName: z
    .string()
    .trim()
    .min(1, 'Customer name is required')
    .max(80, 'Customer name must be at most 80 characters'),
  customerId: uuidSchema.optional(),
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be at most 200 characters')
    .optional(),
  channel: z.enum(['web', 'email', 'api', 'widget']).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  assignedAgentId: uuidSchema.optional(),
  initialMessage: z
    .string()
    .trim()
    .min(1, 'Message body is required')
    .max(10_000, 'Message body must be at most 10000 characters')
    .optional(),
  initialMessageAuthor: z.enum(['customer', 'agent']).optional(),
});

export const changeConversationStatusBodySchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'closed']),
});

export const assignConversationBodySchema = z.object({
  assignedAgentId: uuidSchema,
});

export const escalateConversationBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason must be at most 500 characters')
    .optional(),
});

export const addConversationTagBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tag name is required')
    .max(32, 'Tag name must be at most 32 characters'),
});

export const sendMessageBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body is required')
    .max(10_000, 'Message body must be at most 10000 characters')
    .optional(),
  authorType: z.enum(['customer', 'agent']).optional(),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
});

export const addConversationNoteBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Note body is required')
    .max(5000, 'Note body must be at most 5000 characters'),
});

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['open', 'pending', 'resolved', 'closed', 'escalated']).optional(),
  ),
  assignedAgentId: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .refine((value) => value === 'unassigned' || z.string().uuid().safeParse(value).success, {
        message: 'assignedAgentId must be a user id or unassigned',
      })
      .optional(),
  ),
  tag: z.preprocess(emptyToUndefined, z.string().trim().max(32).optional()),
});

export const conversationPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
