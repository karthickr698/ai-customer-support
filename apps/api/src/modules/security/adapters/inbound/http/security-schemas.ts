import {
  SECURITY_AUDIT_OUTCOMES,
  SECURITY_ENCRYPTION_ALGORITHMS,
  SECURITY_SECRET_PURPOSES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const updatePolicyBodySchema = z.object({
  ipAllowlistEnabled: z.boolean().optional(),
  mfaRequired: z.boolean().optional(),
  sessionIdleTimeoutSeconds: z.number().int().min(300).max(86_400).optional(),
  maxRequestBytes: z.number().int().min(1_024).max(10 * 1_024 * 1_024).optional(),
  rateLimitPerMinute: z.number().int().min(10).max(10_000).optional(),
  auditRetentionDays: z.number().int().min(7).max(2_555).optional(),
});

export const addIpAllowlistBodySchema = z.object({
  cidr: z.string().trim().min(3).max(80),
  label: z.string().trim().min(1).max(80).optional(),
});

export const createSecretBodySchema = z.object({
  name: z.string().trim().min(2).max(64),
  purpose: z.enum(SECURITY_SECRET_PURPOSES),
  plaintext: z.string().min(1).max(16_384),
});

export const rotateSecretBodySchema = z.object({
  plaintext: z.string().min(1).max(16_384),
});

export const encryptBodySchema = z.object({
  plaintext: z.string().min(1).max(16_384),
});

export const decryptBodySchema = z.object({
  algorithm: z.enum(SECURITY_ENCRYPTION_ALGORITHMS).optional(),
  keyVersion: z.number().int().min(1).max(10_000),
  ciphertext: z.string().min(1).max(64_000),
  nonce: z.string().min(1).max(512),
});

export const auditLogQuerySchema = z.object({
  ...pageQuery,
  action: z.string().trim().min(1).max(80).optional(),
  outcome: z.enum(SECURITY_AUDIT_OUTCOMES).optional(),
  resourceType: z.string().trim().min(1).max(80).optional(),
});
