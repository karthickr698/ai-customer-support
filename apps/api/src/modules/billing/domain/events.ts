import type { DomainEvent } from '@ai-customer-support/shared';

export class SubscriptionCreatedEvent implements DomainEvent {
  readonly eventName = 'SubscriptionCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly planSlug: string,
    readonly status: string,
    readonly correlationId?: string,
  ) {}
}

export class SubscriptionUpdatedEvent implements DomainEvent {
  readonly eventName = 'SubscriptionUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly planSlug: string,
    readonly status: string,
    readonly correlationId?: string,
  ) {}
}

export class SubscriptionCanceledEvent implements DomainEvent {
  readonly eventName = 'SubscriptionCanceled';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly immediately: boolean,
    readonly correlationId?: string,
  ) {}
}

export class UsageRecordedEvent implements DomainEvent {
  readonly eventName = 'UsageRecorded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly metric: string,
    readonly quantity: number,
    readonly correlationId?: string,
  ) {}
}

export class QuotaExceededEvent implements DomainEvent {
  readonly eventName = 'QuotaExceeded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly subscriptionId: string,
    readonly metric: string,
    readonly used: number,
    readonly included: number | null,
    readonly correlationId?: string,
  ) {}
}

export class InvoiceFinalizedEvent implements DomainEvent {
  readonly eventName = 'InvoiceFinalized';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly invoiceId: string,
    readonly number: string,
    readonly totalCents: number,
    readonly correlationId?: string,
  ) {}
}

export class InvoicePaidEvent implements DomainEvent {
  readonly eventName = 'InvoicePaid';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly invoiceId: string,
    readonly number: string,
    readonly totalCents: number,
    readonly correlationId?: string,
  ) {}
}

export class InvoicePaymentFailedEvent implements DomainEvent {
  readonly eventName = 'InvoicePaymentFailed';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly invoiceId: string,
    readonly number: string,
    readonly correlationId?: string,
  ) {}
}

export class BillingCheckoutCompletedEvent implements DomainEvent {
  readonly eventName = 'BillingCheckoutCompleted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly checkoutSessionId: string,
    readonly planSlug: string,
    readonly correlationId?: string,
  ) {}
}
