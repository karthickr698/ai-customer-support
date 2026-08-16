import { describe, expect, it } from 'vitest';
import type { RealtimeServerMessage, RealtimeSupportEvent } from '@ai-customer-support/contracts';
import type { WebSocket } from 'ws';
import { RealtimeConnectionHub } from '../../../apps/api/src/modules/conversations/adapters/inbound/websocket/realtime-connection-hub.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const conversationId = '33333333-3333-4333-8333-333333333333';

function fakeSocket() {
  const sent: RealtimeServerMessage[] = [];
  const socket = {
    OPEN: 1,
    readyState: 1,
    send(raw: string) {
      sent.push(JSON.parse(raw) as RealtimeServerMessage);
    },
  };

  return { socket: socket as unknown as WebSocket, sent };
}

function supportEvent(
  name: RealtimeSupportEvent['name'],
  options: { readonly conversationId?: string } = {},
): RealtimeSupportEvent {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: '2026-08-16T12:00:00.000Z',
    name,
    tenantId,
    conversationId: options.conversationId,
    payload: {},
  };
}

describe('RealtimeConnectionHub', () => {
  it('hides internal notes from widget clients and scopes them to their conversation', () => {
    const hub = new RealtimeConnectionHub();
    const widget = fakeSocket();
    const otherWidget = fakeSocket();
    const agent = fakeSocket();

    hub.add({
      id: 'widget-1',
      kind: 'widget',
      tenantId,
      userId: 'session-1',
      conversationId,
      lastEventId: null,
      socket: widget.socket,
    });
    hub.add({
      id: 'widget-2',
      kind: 'widget',
      tenantId,
      userId: 'session-2',
      conversationId: '44444444-4444-4444-8444-444444444444',
      lastEventId: null,
      socket: otherWidget.socket,
    });
    hub.add({
      id: 'agent-1',
      kind: 'agent',
      tenantId,
      userId: 'agent-1',
      lastEventId: null,
      socket: agent.socket,
    });

    hub.sendToTenant(supportEvent('conversation.note_added', { conversationId }));
    hub.sendToTenant(supportEvent('conversation.message_sent', { conversationId }));

    expect(widget.sent.map((message) => (message.type === 'event' ? message.event.name : message.type))).toEqual([
      'conversation.message_sent',
    ]);
    expect(otherWidget.sent).toEqual([]);
    expect(agent.sent.map((message) => (message.type === 'event' ? message.event.name : message.type))).toEqual([
      'conversation.note_added',
      'conversation.message_sent',
    ]);
  });

  it('does not echo typing to the sender', () => {
    const hub = new RealtimeConnectionHub();
    const sender = fakeSocket();
    const peer = fakeSocket();

    hub.add({
      id: 'agent-sender',
      kind: 'agent',
      tenantId,
      userId: 'agent-1',
      conversationId,
      lastEventId: null,
      socket: sender.socket,
    });
    hub.add({
      id: 'widget-peer',
      kind: 'widget',
      tenantId,
      userId: 'session-1',
      conversationId,
      lastEventId: null,
      socket: peer.socket,
    });

    hub.sendEphemeral({
      type: 'typing',
      tenantId,
      conversationId,
      actorId: 'agent-1',
      actorType: 'agent',
      displayName: 'Alex Agent',
      active: true,
      senderId: 'agent-1',
    });

    expect(sender.sent).toEqual([]);
    expect(peer.sent).toEqual([
      {
        type: 'typing',
        conversationId,
        actorId: 'agent-1',
        actorType: 'agent',
        displayName: 'Alex Agent',
        active: true,
      },
    ]);
  });
});
