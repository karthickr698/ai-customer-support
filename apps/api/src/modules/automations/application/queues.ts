import type { DomainEvent } from '@ai-customer-support/shared';
import { AUTOMATION_EXECUTE_QUEUE } from '../domain/automation-policy.js';

export { AUTOMATION_EXECUTE_QUEUE };

export type AutomationExecuteJob = {
  readonly tenantId: string;
  readonly jobId: string;
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
