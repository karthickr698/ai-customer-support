import {
  PLATFORM_AUDIT_OUTCOMES,
  PLATFORM_ROLES,
  PLATFORM_TENANT_STATUSES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const grantOperatorBodySchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(PLATFORM_ROLES),
});

export const changeOperatorRoleBodySchema = z.object({
  role: z.enum(PLATFORM_ROLES),
});

export const operatorListQuerySchema = z.object({
  includeRevoked: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export const tenantListQuerySchema = z.object({
  ...pageQuery,
  status: z.enum(PLATFORM_TENANT_STATUSES).optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

export const createFeatureFlagBodySchema = z.object({
  key: z.string().trim().min(2).max(64),
  description: z.string().trim().min(1).max(240).optional(),
  enabled: z.boolean().optional(),
});

export const updateFeatureFlagBodySchema = z.object({
  description: z.string().trim().min(1).max(240).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const setFeatureFlagOverrideBodySchema = z.object({
  enabled: z.boolean(),
});

export const evaluateFeatureFlagQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const auditLogQuerySchema = z.object({
  ...pageQuery,
  action: z.string().trim().min(1).max(80).optional(),
  outcome: z.enum(PLATFORM_AUDIT_OUTCOMES).optional(),
  resourceType: z.string().trim().min(1).max(80).optional(),
  organizationId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
});
