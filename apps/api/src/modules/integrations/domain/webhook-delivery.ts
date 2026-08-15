import {
  WEBHOOK_DELIVERY_STATUSES,
  type WebhookDeliveryStatus,
  type WebhookEventName,
} from '@ai-customer-support/contracts';
import { InvalidWebhookSubscriptionError } from './errors.js';
import { createWebhookDeliveryId, type WebhookDeliveryId, type WebhookSubscriptionId } from './ids.js';

export type WebhookDeliverySnapshot = {
  readonly id: WebhookDeliveryId;
  readonly organizationId: string;
  readonly subscriptionId: WebhookSubscriptionId;
  readonly eventName: WebhookEventName;
  readonly payload: Record<string, unknown>;
  readonly status: WebhookDeliveryStatus;
  readonly attemptCount: number;
  readonly responseStatus?: number;
  readonly errorMessage?: string;
  readonly nextAttemptAt?: Date;
  readonly createdAt: Date;
  readonly completedAt?: Date;
};

export class WebhookDelivery {
  private constructor(
    readonly id: WebhookDeliveryId,
    readonly organizationId: string,
    readonly subscriptionId: WebhookSubscriptionId,
    readonly eventName: WebhookEventName,
    readonly payload: Record<string, unknown>,
    readonly status: WebhookDeliveryStatus,
    readonly attemptCount: number,
    readonly responseStatus: number | undefined,
    readonly errorMessage: string | undefined,
    readonly nextAttemptAt: Date | undefined,
    readonly createdAt: Date,
    readonly completedAt: Date | undefined,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly subscriptionId: WebhookSubscriptionId;
    readonly eventName: WebhookEventName;
    readonly payload: Record<string, unknown>;
    readonly now: Date;
    readonly id?: WebhookDeliveryId;
  }): WebhookDelivery {
    return new WebhookDelivery(
      input.id ?? createWebhookDeliveryId(),
      input.organizationId,
      input.subscriptionId,
      input.eventName,
      input.payload,
      'pending',
      0,
      undefined,
      undefined,
      undefined,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: WebhookDeliverySnapshot): WebhookDelivery {
    return new WebhookDelivery(
      snapshot.id,
      snapshot.organizationId,
      snapshot.subscriptionId,
      snapshot.eventName,
      snapshot.payload,
      snapshot.status,
      snapshot.attemptCount,
      snapshot.responseStatus,
      snapshot.errorMessage,
      snapshot.nextAttemptAt,
      snapshot.createdAt,
      snapshot.completedAt,
    );
  }

  markSucceeded(input: { readonly responseStatus: number; readonly now: Date; readonly attemptCount: number }): WebhookDelivery {
    return new WebhookDelivery(
      this.id,
      this.organizationId,
      this.subscriptionId,
      this.eventName,
      this.payload,
      'succeeded',
      input.attemptCount,
      input.responseStatus,
      undefined,
      undefined,
      this.createdAt,
      input.now,
    );
  }

  markFailed(input: {
    readonly responseStatus?: number;
    readonly errorMessage: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: Date;
    readonly now: Date;
  }): WebhookDelivery {
    return new WebhookDelivery(
      this.id,
      this.organizationId,
      this.subscriptionId,
      this.eventName,
      this.payload,
      'failed',
      input.attemptCount,
      input.responseStatus,
      input.errorMessage.slice(0, 500),
      input.nextAttemptAt,
      this.createdAt,
      input.now,
    );
  }

  toSnapshot(): WebhookDeliverySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      subscriptionId: this.subscriptionId,
      eventName: this.eventName,
      payload: this.payload,
      status: this.status,
      attemptCount: this.attemptCount,
      responseStatus: this.responseStatus,
      errorMessage: this.errorMessage,
      nextAttemptAt: this.nextAttemptAt,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
    };
  }
}

export function parseWebhookDeliveryStatus(value: string): WebhookDeliveryStatus {
  if (!(WEBHOOK_DELIVERY_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidWebhookSubscriptionError('Invalid webhook delivery status');
  }
  return value as WebhookDeliveryStatus;
}
