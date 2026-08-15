import {
  WEBHOOK_ATTEMPT_STATUSES,
  type WebhookAttemptStatus,
} from '@ai-customer-support/contracts';
import { InvalidWebhookSubscriptionError } from './errors.js';
import {
  createWebhookDeliveryAttemptId,
  type WebhookDeliveryAttemptId,
  type WebhookDeliveryId,
} from './ids.js';
import { WEBHOOK_ERROR_MESSAGE_LENGTH, WEBHOOK_RESPONSE_PREVIEW_LENGTH } from './webhook-retry-policy.js';

export type WebhookDeliveryAttemptSnapshot = {
  readonly id: WebhookDeliveryAttemptId;
  readonly organizationId: string;
  readonly deliveryId: WebhookDeliveryId;
  readonly attempt: number;
  readonly status: WebhookAttemptStatus;
  readonly responseStatus?: number;
  readonly durationMs: number;
  readonly signatureTimestamp: number;
  readonly signatureHeader: string;
  readonly errorMessage?: string;
  readonly responseBodyPreview?: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
};

export class WebhookDeliveryAttempt {
  private constructor(
    readonly id: WebhookDeliveryAttemptId,
    readonly organizationId: string,
    readonly deliveryId: WebhookDeliveryId,
    readonly attempt: number,
    readonly status: WebhookAttemptStatus,
    readonly responseStatus: number | undefined,
    readonly durationMs: number,
    readonly signatureTimestamp: number,
    readonly signatureHeader: string,
    readonly errorMessage: string | undefined,
    readonly responseBodyPreview: string | undefined,
    readonly startedAt: Date,
    readonly finishedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly deliveryId: WebhookDeliveryId;
    readonly attempt: number;
    readonly status: WebhookAttemptStatus;
    readonly responseStatus?: number;
    readonly durationMs: number;
    readonly signatureTimestamp: number;
    readonly signatureHeader: string;
    readonly errorMessage?: string;
    readonly responseBodyPreview?: string;
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly id?: WebhookDeliveryAttemptId;
  }): WebhookDeliveryAttempt {
    return new WebhookDeliveryAttempt(
      input.id ?? createWebhookDeliveryAttemptId(),
      input.organizationId,
      input.deliveryId,
      input.attempt,
      input.status,
      input.responseStatus,
      Math.max(0, Math.round(input.durationMs)),
      input.signatureTimestamp,
      input.signatureHeader,
      truncate(input.errorMessage, WEBHOOK_ERROR_MESSAGE_LENGTH),
      truncate(input.responseBodyPreview, WEBHOOK_RESPONSE_PREVIEW_LENGTH),
      input.startedAt,
      input.finishedAt,
    );
  }

  static reconstitute(snapshot: WebhookDeliveryAttemptSnapshot): WebhookDeliveryAttempt {
    return new WebhookDeliveryAttempt(
      snapshot.id,
      snapshot.organizationId,
      snapshot.deliveryId,
      snapshot.attempt,
      snapshot.status,
      snapshot.responseStatus,
      snapshot.durationMs,
      snapshot.signatureTimestamp,
      snapshot.signatureHeader,
      snapshot.errorMessage,
      snapshot.responseBodyPreview,
      snapshot.startedAt,
      snapshot.finishedAt,
    );
  }

  toSnapshot(): WebhookDeliveryAttemptSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      deliveryId: this.deliveryId,
      attempt: this.attempt,
      status: this.status,
      responseStatus: this.responseStatus,
      durationMs: this.durationMs,
      signatureTimestamp: this.signatureTimestamp,
      signatureHeader: this.signatureHeader,
      errorMessage: this.errorMessage,
      responseBodyPreview: this.responseBodyPreview,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
    };
  }
}

export function parseWebhookAttemptStatus(value: string): WebhookAttemptStatus {
  if (!(WEBHOOK_ATTEMPT_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidWebhookSubscriptionError('Invalid webhook attempt status');
  }
  return value as WebhookAttemptStatus;
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.slice(0, max);
}
