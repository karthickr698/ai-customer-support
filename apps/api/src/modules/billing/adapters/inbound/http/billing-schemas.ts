import {
  BILLING_INVOICE_STATUSES,
  BILLING_USAGE_METRICS,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const startCheckoutBodySchema = z.object({
  planSlug: z.string().trim().min(1).max(80),
  successUrl: z.string().url().max(2_000).optional(),
  cancelUrl: z.string().url().max(2_000).optional(),
});

export const completeCheckoutBodySchema = z.object({
  sessionId: z.string().uuid(),
});

export const changePlanBodySchema = z.object({
  planSlug: z.string().trim().min(1).max(80),
});

export const cancelSubscriptionBodySchema = z.object({
  immediately: z.boolean().optional(),
});

export const recordUsageBodySchema = z.object({
  metric: z.enum(BILLING_USAGE_METRICS),
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  idempotencyKey: z.string().trim().min(1).max(80).optional(),
  enforceQuota: z.boolean().optional(),
});

export const checkQuotaBodySchema = z.object({
  metric: z.enum(BILLING_USAGE_METRICS),
  quantity: z.number().int().min(1).max(1_000_000).optional(),
});

export const invoiceListQuerySchema = z.object({
  ...pageQuery,
  status: z.enum(BILLING_INVOICE_STATUSES).optional(),
});

export const issueInvoiceBodySchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});
