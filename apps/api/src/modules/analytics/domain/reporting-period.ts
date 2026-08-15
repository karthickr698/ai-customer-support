import type { AnalyticsGranularity } from '@ai-customer-support/contracts';
import {
  DEFAULT_RANGE_DAYS,
  MAX_HOUR_RANGE_DAYS,
  MAX_RANGE_DAYS,
} from './analytics-policy.js';
import { InvalidAnalyticsQueryError } from './errors.js';
import { parseGranularity } from './values.js';

const MS_PER_DAY = 86_400_000;

export class ReportingPeriod {
  private constructor(
    readonly from: Date,
    readonly to: Date,
    readonly granularity: AnalyticsGranularity,
  ) {}

  static create(input: {
    readonly from?: string;
    readonly to?: string;
    readonly granularity?: string;
    readonly now: Date;
  }): ReportingPeriod {
    const granularity = parseGranularity(input.granularity);
    const to = input.to === undefined ? input.now : parseInstant(input.to, 'to');
    const from =
      input.from === undefined
        ? new Date(to.getTime() - DEFAULT_RANGE_DAYS * MS_PER_DAY)
        : parseInstant(input.from, 'from');

    if (from.getTime() >= to.getTime()) {
      throw new InvalidAnalyticsQueryError('from must be earlier than to');
    }

    const rangeDays = (to.getTime() - from.getTime()) / MS_PER_DAY;
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new InvalidAnalyticsQueryError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }
    if (granularity === 'hour' && rangeDays > MAX_HOUR_RANGE_DAYS) {
      throw new InvalidAnalyticsQueryError(
        `Hourly series cannot exceed ${MAX_HOUR_RANGE_DAYS} days`,
      );
    }

    return new ReportingPeriod(from, to, granularity);
  }

  toDto(): { from: string; to: string; granularity: AnalyticsGranularity } {
    return {
      from: this.from.toISOString(),
      to: this.to.toISOString(),
      granularity: this.granularity,
    };
  }
}

export function enumerateBuckets(
  from: Date,
  to: Date,
  granularity: AnalyticsGranularity,
): Date[] {
  const buckets: Date[] = [];
  let cursor = truncateUtc(from, granularity);
  if (cursor.getTime() < from.getTime()) {
    cursor = addBucket(cursor, granularity);
  }
  while (cursor.getTime() < to.getTime()) {
    buckets.push(new Date(cursor.getTime()));
    cursor = addBucket(cursor, granularity);
  }
  return buckets;
}

export function alignSeries(
  from: Date,
  to: Date,
  granularity: AnalyticsGranularity,
  points: readonly { readonly bucket: Date; readonly value: number }[],
): { bucket: string; value: number }[] {
  const byTime = new Map<number, number>();
  for (const point of points) {
    const aligned = truncateUtc(point.bucket, granularity).getTime();
    byTime.set(aligned, (byTime.get(aligned) ?? 0) + point.value);
  }
  return enumerateBuckets(from, to, granularity).map((bucket) => ({
    bucket: bucket.toISOString(),
    value: byTime.get(bucket.getTime()) ?? 0,
  }));
}

function parseInstant(value: string, label: string): Date {
  const trimmed = value.trim();
  const parsed = Date.parse(trimmed.length === 10 ? `${trimmed}T00:00:00.000Z` : trimmed);
  if (Number.isNaN(parsed)) {
    throw new InvalidAnalyticsQueryError(`${label} must be an ISO-8601 date or datetime`);
  }
  return new Date(parsed);
}

function truncateUtc(value: Date, granularity: AnalyticsGranularity): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const date = value.getUTCDate();
  const hour = value.getUTCHours();

  if (granularity === 'hour') {
    return new Date(Date.UTC(year, month, date, hour, 0, 0, 0));
  }
  if (granularity === 'day') {
    return new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
  }
  if (granularity === 'month') {
    return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  }

  const day = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
  const weekday = day.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(day.getTime() - daysFromMonday * MS_PER_DAY);
}

function addBucket(value: Date, granularity: AnalyticsGranularity): Date {
  if (granularity === 'hour') {
    return new Date(value.getTime() + 3_600_000);
  }
  if (granularity === 'day') {
    return new Date(value.getTime() + MS_PER_DAY);
  }
  if (granularity === 'week') {
    return new Date(value.getTime() + 7 * MS_PER_DAY);
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}
