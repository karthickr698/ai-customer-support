import type { RealtimeEventName, RealtimeSupportEvent } from '@ai-customer-support/contracts';
import type { DomainEvent } from '@ai-customer-support/shared';

const EVENT_NAMES: Record<string, RealtimeEventName> = {
  ConversationCreated: 'conversation.created',
  MessageReceived: 'conversation.message_received',
  MessageSent: 'conversation.message_sent',
  ConversationStatusChanged: 'conversation.status_changed',
  ConversationEscalated: 'conversation.escalated',
  AgentAssigned: 'conversation.assigned',
  AgentUnassigned: 'conversation.unassigned',
  ConversationNoteAdded: 'conversation.note_added',
  AgentPresenceChanged: 'agent.presence_changed',
};

export function toRealtimeSupportEvent(event: DomainEvent): RealtimeSupportEvent | undefined {
  const name = EVENT_NAMES[event.eventName];
  if (!name || !event.tenantId) {
    return undefined;
  }

  const record = event as DomainEvent & Record<string, unknown>;
  const conversationId = typeof record.conversationId === 'string' ? record.conversationId : undefined;
  const payload: Record<string, unknown> = { eventName: event.eventName };

  for (const [key, value] of Object.entries(record)) {
    if (
      key === 'eventId' ||
      key === 'eventName' ||
      key === 'occurredAt' ||
      key === 'tenantId' ||
      key === 'correlationId' ||
      key === 'conversationId'
    ) {
      continue;
    }

    payload[key] = value instanceof Date ? value.toISOString() : value;
  }

  return {
    eventId: event.eventId,
    occurredAt: event.occurredAt.toISOString(),
    name,
    tenantId: event.tenantId,
    conversationId,
    payload,
  };
}
