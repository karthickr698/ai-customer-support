import type { BillingProviderName } from '@ai-customer-support/contracts';
import { InvalidBillingError } from './errors.js';
import { createBillingProviderEventId, type BillingProviderEventId } from './ids.js';
import { jsonRecord, parseProviderName } from './values.js';

export type NormalizedProviderEvent = {
  readonly provider: BillingProviderName;
  readonly providerEventId: string;
  readonly type: string;
  readonly tenantId?: string;
  readonly checkoutSessionId?: string;
  readonly customerId?: string;
  readonly subscriptionId?: string;
  readonly invoiceId?: string;
  readonly planSlug?: string;
  readonly status?: string;
  readonly amountPaidCents?: number;
  readonly currency?: string;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly paymentBrand?: string;
  readonly paymentLastFour?: string;
  readonly payload: Record<string, unknown>;
};

export type BillingProviderEventSnapshot = {
  readonly id: BillingProviderEventId;
  readonly provider: BillingProviderName;
  readonly providerEventId: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly processedAt?: Date;
  readonly error?: string;
  readonly createdAt: Date;
};

export class BillingProviderEvent {
  private constructor(
    readonly id: BillingProviderEventId,
    readonly provider: BillingProviderName,
    readonly providerEventId: string,
    readonly type: string,
    readonly payload: Record<string, unknown>,
    private processedAtValue: Date | undefined,
    private errorValue: string | undefined,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly provider: string;
    readonly providerEventId: string;
    readonly type: string;
    readonly payload: unknown;
    readonly now: Date;
    readonly id?: BillingProviderEventId;
  }): BillingProviderEvent {
    const eventId = input.providerEventId.trim();
    const type = input.type.trim();
    if (eventId.length < 1 || eventId.length > 200) {
      throw new InvalidBillingError('Provider event id is required');
    }
    if (type.length < 1 || type.length > 120) {
      throw new InvalidBillingError('Provider event type is required');
    }
    return new BillingProviderEvent(
      input.id ?? createBillingProviderEventId(),
      parseProviderName(input.provider),
      eventId,
      type,
      jsonRecord(input.payload),
      undefined,
      undefined,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingProviderEventSnapshot): BillingProviderEvent {
    return new BillingProviderEvent(
      snapshot.id,
      snapshot.provider,
      snapshot.providerEventId,
      snapshot.type,
      snapshot.payload,
      snapshot.processedAt,
      snapshot.error,
      snapshot.createdAt,
    );
  }

  get processedAt(): Date | undefined {
    return this.processedAtValue;
  }

  get error(): string | undefined {
    return this.errorValue;
  }

  get processed(): boolean {
    return this.processedAtValue !== undefined;
  }

  markProcessed(now: Date): void {
    this.processedAtValue = now;
    this.errorValue = undefined;
  }

  markFailed(message: string, now: Date): void {
    this.processedAtValue = now;
    this.errorValue = message.slice(0, 2_000);
  }

  toSnapshot(): BillingProviderEventSnapshot {
    return {
      id: this.id,
      provider: this.provider,
      providerEventId: this.providerEventId,
      type: this.type,
      payload: this.payload,
      processedAt: this.processedAtValue,
      error: this.errorValue,
      createdAt: this.createdAt,
    };
  }
}
