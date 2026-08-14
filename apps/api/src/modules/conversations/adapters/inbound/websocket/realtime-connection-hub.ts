import type { RealtimeServerMessage, RealtimeSupportEvent } from '@ai-customer-support/contracts';
import type { WebSocket } from 'ws';

export type RealtimeConnection = {
  readonly id: string;
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
      if (connection.tenantId !== event.tenantId) {
        continue;
      }

      if (connection.conversationId && event.conversationId && connection.conversationId !== event.conversationId) {
        continue;
      }

      if (connection.socket.readyState !== connection.socket.OPEN) {
        continue;
      }

      connection.lastEventId = event.eventId;
      connection.socket.send(JSON.stringify(message));
    }
  }
}
