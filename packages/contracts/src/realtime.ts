import type { AgentPresenceDto, AgentPresenceStatus } from './agents.js';

export const REALTIME_EVENT_NAMES = [
  'conversation.created',
  'conversation.message_received',
  'conversation.message_sent',
  'conversation.status_changed',
  'conversation.priority_changed',
  'conversation.escalated',
  'conversation.assigned',
  'conversation.unassigned',
  'conversation.note_added',
  'agent.presence_changed',
] as const;
export type RealtimeEventName = (typeof REALTIME_EVENT_NAMES)[number];

export const WIDGET_HIDDEN_REALTIME_EVENTS: ReadonlySet<RealtimeEventName> = new Set([
  'conversation.note_added',
]);

export const TYPING_ACTOR_TYPES = ['agent', 'customer'] as const;
export type TypingActorType = (typeof TYPING_ACTOR_TYPES)[number];

export type RealtimeSupportEvent = {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly name: RealtimeEventName;
  readonly tenantId: string;
  readonly conversationId?: string;
  readonly payload: Record<string, unknown>;
};

export type RealtimeEventListResponse = {
  readonly items: readonly RealtimeSupportEvent[];
  readonly lastEventId: string | null;
  readonly resyncRequired: boolean;
};

export type RealtimeClientMessage =
  | { readonly type: 'heartbeat' }
  | { readonly type: 'resume'; readonly lastEventId: string }
  | { readonly type: 'presence.set'; readonly status: Exclude<AgentPresenceStatus, 'offline'> }
  | { readonly type: 'subscribe'; readonly conversationId?: string }
  | { readonly type: 'unsubscribe' }
  | { readonly type: 'typing.start'; readonly conversationId: string }
  | { readonly type: 'typing.stop'; readonly conversationId: string };

export type RealtimeTypingMessage = {
  readonly type: 'typing';
  readonly conversationId: string;
  readonly actorId: string;
  readonly actorType: TypingActorType;
  readonly displayName: string;
  readonly active: boolean;
};

export type RealtimeAssigneePresenceMessage = {
  readonly type: 'assignee_presence';
  readonly conversationId: string;
  readonly agentId: string;
  readonly status: AgentPresenceStatus;
};

export type RealtimeEphemeralMessage = RealtimeTypingMessage | RealtimeAssigneePresenceMessage;

export type RealtimeServerMessage =
  | {
      readonly type: 'connected';
      readonly connectionId: string;
      readonly serverTime: string;
      readonly lastEventId: string | null;
      readonly heartbeatIntervalMs: number;
      readonly replayed: number;
    }
  | {
      readonly type: 'event';
      readonly event: RealtimeSupportEvent;
    }
  | {
      readonly type: 'presence.snapshot';
      readonly items: readonly AgentPresenceDto[];
    }
  | {
      readonly type: 'resync_required';
      readonly lastEventId: string | null;
    }
  | {
      readonly type: 'pong';
      readonly serverTime: string;
    }
  | {
      readonly type: 'error';
      readonly code: string;
      readonly message: string;
    }
  | RealtimeTypingMessage
  | RealtimeAssigneePresenceMessage;
