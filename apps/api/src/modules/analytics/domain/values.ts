import {
  ANALYTICS_GRANULARITIES,
  ANALYTICS_METRICS,
  ANALYTICS_REPORTS,
  type AnalyticsGranularity,
  type AnalyticsMetric,
  type AnalyticsReport,
} from '@ai-customer-support/contracts';
import { InvalidAnalyticsQueryError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseGranularity(value: string | undefined): AnalyticsGranularity {
  const granularity = (value ?? 'day').trim();
  if (!(ANALYTICS_GRANULARITIES as readonly string[]).includes(granularity)) {
    throw new InvalidAnalyticsQueryError('Granularity must be hour, day, week, or month');
  }
  return granularity as AnalyticsGranularity;
}

export function parseMetrics(values: readonly string[] | undefined): readonly AnalyticsMetric[] {
  if (!values || values.length === 0) {
    return ['conversations.created', 'tickets.created', 'messages.created'];
  }
  const unique: AnalyticsMetric[] = [];
  for (const raw of values) {
    const metric = raw.trim();
    if (!(ANALYTICS_METRICS as readonly string[]).includes(metric)) {
      throw new InvalidAnalyticsQueryError(`Unknown analytics metric: ${metric}`);
    }
    if (!unique.includes(metric as AnalyticsMetric)) {
      unique.push(metric as AnalyticsMetric);
    }
  }
  if (unique.length === 0) {
    throw new InvalidAnalyticsQueryError('At least one metric is required');
  }
  if (unique.length > ANALYTICS_METRICS.length) {
    throw new InvalidAnalyticsQueryError('Too many metrics requested');
  }
  return unique;
}

export function parseReport(value: string): AnalyticsReport {
  const report = value.trim();
  if (!(ANALYTICS_REPORTS as readonly string[]).includes(report)) {
    throw new InvalidAnalyticsQueryError('Unknown analytics report');
  }
  return report as AnalyticsReport;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new InvalidAnalyticsQueryError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function parseOptionalUuid(value: string | undefined, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireUuid(value, label);
}

export function parseOptionalChannel(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const channel = value.trim();
  if (channel.length === 0 || channel.length > 40) {
    throw new InvalidAnalyticsQueryError('Channel filter is invalid');
  }
  return channel;
}

export function parseOptionalStatus(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const status = value.trim();
  if (status.length === 0 || status.length > 40) {
    throw new InvalidAnalyticsQueryError('Status filter is invalid');
  }
  return status;
}
