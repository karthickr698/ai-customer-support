import type { AnalyticsGranularity, AnalyticsNamedCountDto } from '@ai-customer-support/contracts';

export function analyticsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/analytics`;
  return segment ? `${base}/${segment}` : base;
}

export function defaultPeriod(): { from: string; to: string; granularity: AnalyticsGranularity } {
  const to = new Date();
  const from = new Date(to.getTime() - 13 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: 'day',
  };
}

export function formatSeconds(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  if (value < 60) {
    return `${String(Math.round(value))}s`;
  }
  const minutes = Math.round(value / 60);
  if (minutes < 60) {
    return `${String(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rem)}m`;
}

export function percent(part: number, total: number): string {
  if (total <= 0) {
    return '—';
  }
  return `${String(Math.round((part / total) * 100))}%`;
}

export function namedCount(items: readonly AnalyticsNamedCountDto[], name: string): number {
  return items.find((item) => item.name === name)?.count ?? 0;
}

export const GRANULARITY_OPTIONS: ReadonlyArray<{ value: AnalyticsGranularity; label: string }> = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const;
