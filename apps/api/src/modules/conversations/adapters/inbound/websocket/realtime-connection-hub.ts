import type {
  RealtimeEphemeralMessage,
  RealtimeServerMessage,
  RealtimeSupportEvent,
} from '@ai-customer-support/contracts';
import { WIDGET_HIDDEN_REALTIME_EVENTS } from '@ai-customer-support/contracts';
import type { WebSocket } from 'ws';
import type { RealtimeEphemeralFanout } from '../../../application/ports/realtime-publisher-port.js';

export type RealtimeConnectionKind = 'agent' | 'widget';

export type RealtimeConnection = {
  readonly id: string;
  readonly kind: RealtimeConnectionKind;
  readonly tenantId: string;
  readonly userId: string;
  conversationId?: string;
  lastEventId: string | null;
  readonly socket: WebSocket;
};

export class RealtimeConnectionHub {
  private readonly connections = new Map<string, RealtimeConnection>();

  add(connection: RealtimeConnection): void {
    this.connections.set(connection.id, connection);
  }

  remove(connectionId: string): RealtimeConnection | undefined {
    const connection = this.connections.get(connectionId);
    this.connections.delete(connectionId);
    return connection;
  }

  get(connectionId: string): RealtimeConnection | undefined {
    return this.connections.get(connectionId);
  }

  send(connectionId: string, message: RealtimeServerMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== connection.socket.OPEN) {
      return;
    }

    connection.socket.send(JSON.stringify(message));
  }

  sendToTenant(event: RealtimeSupportEvent): void {
    const message: RealtimeServerMessage = { type: 'event', event };
    for (const connection of this.connections.values()) {
      if (!this.shouldReceiveEvent(connection, event)) {
        continue;
      }

      if (connection.socket.readyState !== connection.socket.OPEN) {
        continue;
      }

      connection.lastEventId = event.eventId;
      connection.socket.send(JSON.stringify(message));
    }
  }

  sendEphemeral(message: RealtimeEphemeralFanout): void {
    const payload: RealtimeEphemeralMessage =
      message.type === 'typing'
        ? {
            type: 'typing',
            conversationId: message.conversationId,
            actorId: message.actorId,
            actorType: message.actorType,
            displayName: message.displayName,
            active: message.active,
          }
        : {
            type: 'assignee_presence',
            conversationId: message.conversationId,
            agentId: message.agentId,
            status: message.status,
          };

    for (const connection of this.connections.values()) {
      if (connection.tenantId !== message.tenantId) {
        continue;
      }

      if (connection.kind === 'widget' && connection.conversationId !== message.conversationId) {
        continue;
      }

      if (
        connection.kind === 'agent' &&
        connection.conversationId &&
        connection.conversationId !== message.conversationId
      ) {
        continue;
      }

      if (message.senderId && connection.userId === message.senderId) {
        continue;
      }

      if (connection.socket.readyState !== connection.socket.OPEN) {
        continue;
      }

      connection.socket.send(JSON.stringify(payload));
    }
  }

  private shouldReceiveEvent(connection: RealtimeConnection, event: RealtimeSupportEvent): boolean {
    if (connection.tenantId !== event.tenantId) {
      return false;
    }

    if (connection.kind === 'widget') {
      if (!event.conversationId || connection.conversationId !== event.conversationId) {
        return false;
      }

      return !WIDGET_HIDDEN_REALTIME_EVENTS.has(event.name);
    }

    if (connection.conversationId && event.conversationId && connection.conversationId !== event.conversationId) {
      return false;
    }

    return true;
  }
}
