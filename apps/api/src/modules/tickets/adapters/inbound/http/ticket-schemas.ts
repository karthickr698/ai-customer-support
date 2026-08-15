import {
  SLA_POLICY_PRIORITIES,
  TICKET_ESCALATION_ACTIONS,
  TICKET_ESCALATION_TRIGGER_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const createTicketBodySchema = z.object({
  customerEmail: z.string().trim().email().max(254),
  customerName: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(8_000),
  customerId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedAgentId: z.string().uuid().optional(),
});

export const ticketListQuerySchema = z.object({
  ...pageQuery,
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedAgentId: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  conversationId: z.string().uuid().optional(),
  slaBreached: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  q: z.string().trim().min(1).max(200).optional(),
});

export const changeTicketStatusBodySchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

export const assignTicketBodySchema = z.object({
  assignedAgentId: z.string().uuid(),
});

export const escalateTicketBodySchema = z.object({
  reason: z.string().trim().min(1).max(1_000).optional(),
});

export const addTicketNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});

export const ticketNoteListQuerySchema = z.object({
  ...pageQuery,
});

export const createSlaPolicyBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  appliesToPriority: z.enum(SLA_POLICY_PRIORITIES),
  firstResponseMinutes: z.number().int().min(1).max(10_080),
  resolutionMinutes: z.number().int().min(1).max(10_080),
  enabled: z.boolean().optional(),
});

export const updateSlaPolicyBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  appliesToPriority: z.enum(SLA_POLICY_PRIORITIES).optional(),
  firstResponseMinutes: z.number().int().min(1).max(10_080).optional(),
  resolutionMinutes: z.number().int().min(1).max(10_080).optional(),
});

export const createEscalationPolicyBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  triggerType: z.enum(TICKET_ESCALATION_TRIGGER_TYPES),
  action: z.enum(TICKET_ESCALATION_ACTIONS),
  triggerMinutes: z.number().int().min(1).max(10_080).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(1_000).optional(),
});

export const updateEscalationPolicyBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(TICKET_ESCALATION_TRIGGER_TYPES).optional(),
  triggerMinutes: z.number().int().min(1).max(10_080).nullable().optional(),
  action: z.enum(TICKET_ESCALATION_ACTIONS).optional(),
  priority: z.number().int().min(1).max(1_000).optional(),
});
