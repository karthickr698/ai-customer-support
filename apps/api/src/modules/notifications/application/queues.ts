import type { DomainEvent } from '@ai-customer-support/shared';
import { NOTIFICATION_DELIVER_QUEUE } from '../domain/notification-policy.js';

export { NOTIFICATION_DELIVER_QUEUE };

export type NotificationDeliverJob = {
  readonly tenantId: string;
  readonly deliveryId: string;
};

export function domainEventPayload(event: DomainEvent): Record<string, unknown> {
  const record = event as unknown as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    eventName: event.eventName,
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
