import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CONDITION_OPERATORS,
  AUTOMATION_EXECUTION_STATUSES,
  AUTOMATION_HTTP_METHODS,
  AUTOMATION_JOB_STATUSES,
  AUTOMATION_MATCH_MODES,
  AUTOMATION_SOURCE_EVENTS,
  AUTOMATION_TRIGGER_TYPES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const conditionSchema = z.object({
  field: z.string().trim().min(1).max(200),
  operator: z.enum(AUTOMATION_CONDITION_OPERATORS),
  value: z.unknown().optional(),
});

const actionSchema = z
  .object({
    message: z.string().trim().min(1).max(500).optional(),
    url: z.string().trim().url().max(2_000).optional(),
    method: z.enum(AUTOMATION_HTTP_METHODS).optional(),
    headers: z.record(z.string(), z.string().max(500)).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    timeoutMs: z.number().int().min(1_000).max(30_000).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

export const createAutomationRuleBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPES),
  eventName: z.enum(AUTOMATION_SOURCE_EVENTS).optional(),
  schedule: z.string().trim().min(1).max(40).optional(),
  match: z.enum(AUTOMATION_MATCH_MODES).optional(),
  conditions: z.array(conditionSchema).max(20).optional(),
  actionType: z.enum(AUTOMATION_ACTION_TYPES),
  action: actionSchema,
  maxAttempts: z.number().int().min(1).max(20).optional(),
  backoffMs: z.number().int().min(100).max(3_600_000).optional(),
  priority: z.number().int().min(1).max(1_000).optional(),
});

export const updateAutomationRuleBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPES).optional(),
  eventName: z.enum(AUTOMATION_SOURCE_EVENTS).nullable().optional(),
  schedule: z.string().trim().min(1).max(40).nullable().optional(),
  match: z.enum(AUTOMATION_MATCH_MODES).optional(),
  conditions: z.array(conditionSchema).max(20).optional(),
  actionType: z.enum(AUTOMATION_ACTION_TYPES).optional(),
  action: actionSchema,
  maxAttempts: z.number().int().min(1).max(20).optional(),
  backoffMs: z.number().int().min(100).max(3_600_000).optional(),
  priority: z.number().int().min(1).max(1_000).optional(),
});

export const runAutomationBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(80).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const automationJobListQuerySchema = z.object({
  ...pageQuery,
  ruleId: z.string().uuid().optional(),
  status: z.enum(AUTOMATION_JOB_STATUSES).optional(),
});

export const automationLogListQuerySchema = z.object({
  ...pageQuery,
  ruleId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  status: z.enum(AUTOMATION_EXECUTION_STATUSES).optional(),
});
