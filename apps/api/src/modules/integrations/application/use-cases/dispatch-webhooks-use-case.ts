import type { DomainEvent, EventBus } from '@ai-customer-support/shared';
import type { WebhookEventName } from '@ai-customer-support/contracts';
import { WebhookDelivery } from '../../domain/webhook-delivery.js';
import { webhookEventNameFor } from '../../domain/webhook-events.js';
import type { WebhookSubscription } from '../../domain/webhook-subscription.js';
import { WEBHOOK_RETRY_BACKOFF_SECONDS } from '../rate-limits.js';
import type {
  ClockPort,
  SecretCipherPort,
  WebhookDeliveryRepository,
  WebhookDispatcherPort,
  WebhookSignerPort,
  WebhookSubscriptionRepository,
} from '../ports.js';
import { WebhookDeliveryAttemptedEvent } from '../../domain/events.js';

const WEBHOOK_TIMEOUT_MS = 10_000;

export class DispatchWebhooksUseCase {
  constructor(
    private readonly subscriptions: WebhookSubscriptionRepository,
    private readonly deliveries: WebhookDeliveryRepository,
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

  async retry(subscription: WebhookSubscription, delivery: WebhookDelivery) {
    return this.attempt(subscription, delivery);
  }

  private async attempt(subscription: WebhookSubscription, delivery: WebhookDelivery) {
    const now = this.clock.now();
    const timestamp = Math.floor(now.getTime() / 1000);
    const body = JSON.stringify({
      id: delivery.id,
      type: delivery.eventName,
      createdAt: now.toISOString(),
      data: delivery.payload,
    });
    const secret = this.cipher.decrypt(subscription.secret.ciphertext, subscription.secret.nonce);
    const signature = this.signer.sign(secret, timestamp, body);
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
          'x-webhook-signature': this.signer.header(timestamp, signature),
        },
      });
      const succeeded = result.status >= 200 && result.status < 300;
      const updated = succeeded
        ? delivery.markSucceeded({ responseStatus: result.status, now, attemptCount })
        : delivery.markFailed({
            responseStatus: result.status,
            errorMessage: `Webhook endpoint returned HTTP ${result.status}`,
            attemptCount,
            nextAttemptAt: new Date(now.getTime() + WEBHOOK_RETRY_BACKOFF_SECONDS * 1000),
            now,
          });
      await this.deliveries.save(updated);
      await this.eventBus.publish(
        new WebhookDeliveryAttemptedEvent(
          crypto.randomUUID(),
          now,
          subscription.organizationId,
          subscription.id,
          updated.id,
          updated.status,
        ),
      );
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      const updated = delivery.markFailed({
        errorMessage: message,
        attemptCount,
        nextAttemptAt: new Date(now.getTime() + WEBHOOK_RETRY_BACKOFF_SECONDS * 1000),
        now,
      });
      await this.deliveries.save(updated);
      await this.eventBus.publish(
        new WebhookDeliveryAttemptedEvent(
          crypto.randomUUID(),
          now,
          subscription.organizationId,
          subscription.id,
          updated.id,
          updated.status,
        ),
      );
      return updated;
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
