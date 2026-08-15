import type { DomainEvent, EventBus } from '@ai-customer-support/shared';
import type { WebhookEventName } from '@ai-customer-support/contracts';
import { WebhookDelivery } from '../../domain/webhook-delivery.js';
import { WebhookDeliveryAttempt } from '../../domain/webhook-delivery-attempt.js';
import { webhookEventNameFor } from '../../domain/webhook-events.js';
import type { WebhookSubscription } from '../../domain/webhook-subscription.js';
import { WEBHOOK_DISPATCH_BATCH_SIZE } from '../../domain/webhook-retry-policy.js';
import type {
  ClockPort,
  SecretCipherPort,
  WebhookDeliveryAttemptRepository,
  WebhookDeliveryRepository,
  WebhookDispatcherPort,
  WebhookSignerPort,
  WebhookSubscriptionRepository,
} from '../ports.js';
import { WebhookDeliveryAbandonedEvent, WebhookDeliveryAttemptedEvent } from '../../domain/events.js';

const WEBHOOK_TIMEOUT_MS = 10_000;

export class DispatchWebhooksUseCase {
  constructor(
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly attempts: WebhookDeliveryAttemptRepository,
    private readonly dispatcher: WebhookDispatcherPort,
    private readonly signer: WebhookSignerPort,
    private readonly cipher: SecretCipherPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly timeoutMs: number = WEBHOOK_TIMEOUT_MS,
  ) {}

  async handleDomainEvent(event: DomainEvent): Promise<void> {
    const eventName = webhookEventNameFor(event.eventName);
    if (!eventName || !event.tenantId) {
      return;
    }
    const payload = domainEventPayload(event, eventName);
    const subscriptions = await this.subscriptions.listActiveByTenantAndEvent(event.tenantId, eventName);
    for (const subscription of subscriptions) {
      if (!subscription.accepts(eventName)) {
        continue;
      }
      const delivery = WebhookDelivery.create({
        organizationId: event.tenantId,
        subscriptionId: subscription.id,
        eventName,
        payload,
        now: this.clock.now(),
      });
      await this.deliveries.save(delivery);
      await this.attempt(subscription, delivery);
    }
  }

  async retryDue(limit = WEBHOOK_DISPATCH_BATCH_SIZE, tenantId?: string): Promise<number> {
    const due = await this.deliveries.listDue(this.clock.now(), limit, tenantId);
    let retried = 0;
    for (const delivery of due) {
      const subscription = await this.subscriptions.findById(delivery.organizationId, delivery.subscriptionId);
      if (!subscription || !subscription.isActive) {
        continue;
      }
      await this.attempt(subscription, delivery);
      retried += 1;
    }
    return retried;
  }

  async retry(subscription: WebhookSubscription, delivery: WebhookDelivery) {
    return this.attempt(subscription, delivery);
  }

  private async attempt(subscription: WebhookSubscription, delivery: WebhookDelivery) {
    const startedAt = this.clock.now();
    const timestamp = Math.floor(startedAt.getTime() / 1000);
    const body = JSON.stringify({
      id: delivery.id,
      type: delivery.eventName,
      createdAt: startedAt.toISOString(),
      data: delivery.payload,
    });
    const secret = this.cipher.decrypt(subscription.secret.ciphertext, subscription.secret.nonce);
    const signature = this.signer.sign(secret, timestamp, body);
    const signatureHeader = this.signer.header(timestamp, signature);
    const attemptCount = delivery.attemptCount + 1;

    try {
      const result = await this.dispatcher.dispatch({
        url: subscription.url,
        timeoutMs: this.timeoutMs,
        body,
        headers: {
          'content-type': 'application/json',
          'x-webhook-id': delivery.id,
          'x-webhook-event': delivery.eventName,
          'x-webhook-timestamp': String(timestamp),
          'x-webhook-signature': signatureHeader,
        },
      });
      const succeeded = result.status >= 200 && result.status < 300;
      const finishedAt = this.clock.now();
      const updated = succeeded
        ? delivery.markSucceeded({ responseStatus: result.status, now: finishedAt, attemptCount })
        : delivery.markFailed({
            responseStatus: result.status,
            errorMessage: `Webhook endpoint returned HTTP ${result.status}`,
            attemptCount,
            now: finishedAt,
          });
      await this.persistAttempt({
        delivery: updated,
        attemptCount,
        status: succeeded ? 'succeeded' : 'failed',
        responseStatus: result.status,
        durationMs: result.durationMs,
        signatureTimestamp: timestamp,
        signatureHeader,
        errorMessage: succeeded ? undefined : `Webhook endpoint returned HTTP ${result.status}`,
        responseBodyPreview: result.bodyPreview,
        startedAt,
        finishedAt,
      });
      return updated;
    } catch (error: unknown) {
      const finishedAt = this.clock.now();
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      const updated = delivery.markFailed({
        errorMessage: message,
        attemptCount,
        now: finishedAt,
      });
      await this.persistAttempt({
        delivery: updated,
        attemptCount,
        status: 'failed',
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        signatureTimestamp: timestamp,
        signatureHeader,
        errorMessage: message,
        startedAt,
        finishedAt,
      });
      return updated;
    }
  }

  private async persistAttempt(input: {
    readonly delivery: WebhookDelivery;
    readonly attemptCount: number;
    readonly status: 'succeeded' | 'failed';
    readonly responseStatus?: number;
    readonly durationMs: number;
    readonly signatureTimestamp: number;
    readonly signatureHeader: string;
    readonly errorMessage?: string;
    readonly responseBodyPreview?: string;
    readonly startedAt: Date;
    readonly finishedAt: Date;
  }) {
    await this.attempts.save(
      WebhookDeliveryAttempt.create({
        organizationId: input.delivery.organizationId,
        deliveryId: input.delivery.id,
        attempt: input.attemptCount,
        status: input.status,
        responseStatus: input.responseStatus,
        durationMs: input.durationMs,
        signatureTimestamp: input.signatureTimestamp,
        signatureHeader: input.signatureHeader,
        errorMessage: input.errorMessage,
        responseBodyPreview: input.responseBodyPreview,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
      }),
    );
    await this.deliveries.save(input.delivery);
    await this.eventBus.publish(
      new WebhookDeliveryAttemptedEvent(
        crypto.randomUUID(),
        input.finishedAt,
        input.delivery.organizationId,
        input.delivery.subscriptionId,
        input.delivery.id,
        input.delivery.status,
      ),
    );
    if (input.delivery.isAbandoned) {
      await this.eventBus.publish(
        new WebhookDeliveryAbandonedEvent(
          crypto.randomUUID(),
          input.finishedAt,
          input.delivery.organizationId,
          input.delivery.subscriptionId,
          input.delivery.id,
        ),
      );
    }
  }
}

function domainEventPayload(event: DomainEvent, eventName: WebhookEventName): Record<string, unknown> {
  const record = event as unknown as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    eventName,
    domainEventName: event.eventName,
    eventId: event.eventId,
    occurredAt: event.occurredAt.toISOString(),
    tenantId: event.tenantId ?? null,
  };
  for (const [key, value] of Object.entries(record)) {
    if (key === 'eventName' || key === 'occurredAt') {
      continue;
    }
    payload[key] = value instanceof Date ? value.toISOString() : value;
  }
  return payload;
}
