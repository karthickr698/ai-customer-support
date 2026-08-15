import type { BillingUsageMetric } from '@ai-customer-support/contracts';
import { InvalidBillingError } from './errors.js';
import { createBillingUsageRecordId, type BillingSubscriptionId, type BillingUsageRecordId } from './ids.js';
import { parseUsageMetric, requireQuantity } from './values.js';

export type BillingUsageRecordSnapshot = {
  readonly id: BillingUsageRecordId;
  readonly organizationId: string;
  readonly subscriptionId: BillingSubscriptionId;
  readonly metric: BillingUsageMetric;
  readonly quantity: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly source: string;
  readonly sourceEventId?: string;
  readonly idempotencyKey: string;
  readonly createdAt: Date;
};

export class BillingUsageRecord {
  private constructor(
    readonly id: BillingUsageRecordId,
    readonly organizationId: string,
    readonly subscriptionId: BillingSubscriptionId,
    readonly metric: BillingUsageMetric,
    readonly quantity: number,
    readonly periodStart: Date,
    readonly periodEnd: Date,
    readonly source: string,
    readonly sourceEventId: string | undefined,
    readonly idempotencyKey: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly subscriptionId: BillingSubscriptionId;
    readonly metric: string;
    readonly quantity: number;
    readonly periodStart: Date;
    readonly periodEnd: Date;
    readonly source: string;
    readonly idempotencyKey: string;
    readonly now: Date;
    readonly sourceEventId?: string;
    readonly id?: BillingUsageRecordId;
  }): BillingUsageRecord {
    if (!input.organizationId.trim()) {
      throw new InvalidBillingError('Organization is required');
    }
    const key = input.idempotencyKey.trim();
    if (key.length < 1 || key.length > 180) {
      throw new InvalidBillingError('idempotencyKey must be between 1 and 180 characters');
    }
    return new BillingUsageRecord(
      input.id ?? createBillingUsageRecordId(),
      input.organizationId,
      input.subscriptionId,
      parseUsageMetric(input.metric),
      requireQuantity(input.quantity),
      input.periodStart,
      input.periodEnd,
      input.source.trim().slice(0, 40) || 'manual',
      input.sourceEventId,
      key,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingUsageRecordSnapshot): BillingUsageRecord {
    return new BillingUsageRecord(
      snapshot.id,
      snapshot.organizationId,
      snapshot.subscriptionId,
      snapshot.metric,
      snapshot.quantity,
      snapshot.periodStart,
      snapshot.periodEnd,
      snapshot.source,
      snapshot.sourceEventId,
      snapshot.idempotencyKey,
      snapshot.createdAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): BillingUsageRecordSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      subscriptionId: this.subscriptionId,
      metric: this.metric,
      quantity: this.quantity,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      source: this.source,
      sourceEventId: this.sourceEventId,
      idempotencyKey: this.idempotencyKey,
      createdAt: this.createdAt,
    };
  }
}

export function usageIdempotencyKey(
  tenantId: string,
  metric: string,
  source: string,
  key: string,
): string {
  return `${tenantId}:${metric}:${source}:${key}`.slice(0, 180);
}
