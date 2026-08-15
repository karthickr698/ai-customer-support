import {
  OBSERVABILITY_EVALUATION_VERDICTS,
  OBSERVABILITY_INCIDENT_SOURCES,
  OBSERVABILITY_INCIDENT_STATUSES,
  OBSERVABILITY_LOG_LEVELS,
  OBSERVABILITY_SERVICES,
  OBSERVABILITY_SPAN_STATUSES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const periodQuery = {
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
};

export const overviewQuerySchema = z.object({
  ...periodQuery,
  organizationId: z.string().uuid().optional(),
});

export const logQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  organizationId: z.string().uuid().optional(),
  level: z.enum(OBSERVABILITY_LOG_LEVELS).optional(),
  service: z.enum(OBSERVABILITY_SERVICES).optional(),
  route: z.string().trim().min(1).max(200).optional(),
  traceId: z.string().trim().min(1).max(80).optional(),
  errorCode: z.string().trim().min(1).max(80).optional(),
});

export const traceQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  organizationId: z.string().uuid().optional(),
  status: z.enum(OBSERVABILITY_SPAN_STATUSES).optional(),
  service: z.enum(OBSERVABILITY_SERVICES).optional(),
});

export const metricsQuerySchema = z.object({
  ...periodQuery,
  organizationId: z.string().uuid().optional(),
  names: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      return (Array.isArray(value) ? value : value.split(',')).map((item) => item.trim()).filter(Boolean);
    }),
});

export const incidentQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  organizationId: z.string().uuid().optional(),
  status: z.enum(OBSERVABILITY_INCIDENT_STATUSES).optional(),
  source: z.enum(OBSERVABILITY_INCIDENT_SOURCES).optional(),
});

export const evaluationQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  organizationId: z.string().uuid().optional(),
  verdict: z.enum(OBSERVABILITY_EVALUATION_VERDICTS).optional(),
  operation: z.string().trim().min(1).max(80).optional(),
});

export const tenantPeriodQuerySchema = z.object({
  ...periodQuery,
});

export const tenantLogQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  level: z.enum(OBSERVABILITY_LOG_LEVELS).optional(),
  service: z.enum(OBSERVABILITY_SERVICES).optional(),
  route: z.string().trim().min(1).max(200).optional(),
  traceId: z.string().trim().min(1).max(80).optional(),
  errorCode: z.string().trim().min(1).max(80).optional(),
});

export const tenantTraceQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  status: z.enum(OBSERVABILITY_SPAN_STATUSES).optional(),
  service: z.enum(OBSERVABILITY_SERVICES).optional(),
});

export const tenantMetricsQuerySchema = z.object({
  ...periodQuery,
  names: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      return (Array.isArray(value) ? value : value.split(',')).map((item) => item.trim()).filter(Boolean);
    }),
});

export const tenantIncidentQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  status: z.enum(OBSERVABILITY_INCIDENT_STATUSES).optional(),
  source: z.enum(OBSERVABILITY_INCIDENT_SOURCES).optional(),
});

export const tenantEvaluationQuerySchema = z.object({
  ...pageQuery,
  ...periodQuery,
  verdict: z.enum(OBSERVABILITY_EVALUATION_VERDICTS).optional(),
  operation: z.string().trim().min(1).max(80).optional(),
});
