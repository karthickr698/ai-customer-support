import { z } from 'zod';

const uuidSchema = z.string().uuid('Enter a valid id');

export const createEscalationRuleBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().optional(),
  triggerType: z.enum(['unanswered_for', 'unassigned_for', 'assigned_agent_offline', 'keyword_match']),
  triggerMinutes: z.number().int().min(1).max(10_080).optional(),
  keywords: z.array(z.string().trim().min(2).max(64)).max(20).optional(),
  action: z.enum(['escalate', 'escalate_and_unassign', 'assign_available']),
  priority: z.number().int().min(1).max(1_000).optional(),
});

export const updateEscalationRuleBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(['unanswered_for', 'unassigned_for', 'assigned_agent_offline', 'keyword_match']).optional(),
  triggerMinutes: z.number().int().min(1).max(10_080).nullable().optional(),
  keywords: z.array(z.string().trim().min(2).max(64)).max(20).optional(),
  action: z.enum(['escalate', 'escalate_and_unassign', 'assign_available']).optional(),
  priority: z.number().int().min(1).max(1_000).optional(),
});

export const realtimeEventsQuerySchema = z.object({
  after: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const conversationIdParamSchema = uuidSchema;
