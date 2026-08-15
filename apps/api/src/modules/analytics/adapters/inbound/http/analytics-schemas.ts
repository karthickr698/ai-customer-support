import { ANALYTICS_GRANULARITIES, ANALYTICS_METRICS, ANALYTICS_REPORTS } from '@ai-customer-support/contracts';
import { z } from 'zod';

const periodQuery = {
  from: z.string().trim().min(10).max(40).optional(),
  to: z.string().trim().min(10).max(40).optional(),
  granularity: z.enum(ANALYTICS_GRANULARITIES).optional(),
  channel: z.string().trim().min(1).max(40).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  assignedAgentId: z.string().uuid().optional(),
};

export const analyticsPeriodQuerySchema = z.object(periodQuery);

export const analyticsTimeSeriesQuerySchema = z.object({
  ...periodQuery,
  metrics: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      const parts = (Array.isArray(value) ? value : value.split(',')).map((item) => item.trim());
      return parts.filter((item) => item.length > 0);
    })
    .pipe(z.array(z.enum(ANALYTICS_METRICS)).max(ANALYTICS_METRICS.length).optional()),
});

export const analyticsExportQuerySchema = analyticsTimeSeriesQuerySchema;

export const analyticsReportParamSchema = z.object({
  report: z.enum(ANALYTICS_REPORTS),
});
