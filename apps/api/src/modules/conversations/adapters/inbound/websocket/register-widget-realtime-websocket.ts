import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Logger } from '@ai-customer-support/shared';
import type { RealtimeServerMessage } from '@ai-customer-support/contracts';
import type { RawData, WebSocket } from 'ws';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from '../../../../agents/domain/presence-constants.js';
import { createConversationId } from '../../../domain/conversation-id.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import type { ConversationRepository } from '../../../application/ports/conversation-repository.js';
import type { WidgetAuthenticatePreHandler } from '../http/widget-conversation-routes.js';
import type { RealtimeConnectionHub } from './realtime-connection-hub.js';
import type { TypingFanout } from './typing-fanout.js';

const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heartbeat') }),
  z.object({ type: z.literal('typing.start') }),
  z.object({ type: z.literal('typing.stop') }),
]);

export async function registerWidgetRealtimeWebsocket(
  app: FastifyInstance,
  input: {
    readonly hub: RealtimeConnectionHub;
    readonly authenticateWidgetSession: WidgetAuthenticatePreHandler;
    readonly conversations: ConversationRepository;
    readonly typing: TypingFanout;
    readonly logger: Logger;
  },
): Promise<void> {
  app.get(
    '/api/widget/conversations/:conversationId/realtime',
    { websocket: true, preHandler: [input.authenticateWidgetSession] },
    (socket, request) => {
      const session = request.widgetSession;
      if (!session) {
        send(socket, { type: 'error', code: 'UNAUTHORIZED', message: 'Widget session required' });
        socket.close();
        return;
      }

      const params = request.params as Record<string, unknown>;
      const conversationId = typeof params.conversationId === 'string' ? params.conversationId : '';
      const connectionId = crypto.randomUUID();
      const { hub } = input;
      const tenantId = session.organizationId;
      const actorId = session.sessionId;
      const displayName = session.name?.trim() || 'Customer';

      void startSession();

      socket.on('message', (raw: RawData) => {
        void handleMessage(raw.toString());
      });

      socket.on('close', () => {
        hub.remove(connectionId);
        void input.typing.clearActor({
          tenantId,
          conversationId,
          actorId,
          actorType: 'customer',
          displayName,
        });
      });

      socket.on('error', (error: Error) => {
        input.logger.warn('Widget realtime socket error', {
          tenantId,
          conversationId,
          message: error.message,
        });
      });

      async function startSession(): Promise<void> {
        try {
          const conversation = await input.conversations.findById(
            tenantId,
            createConversationId(conversationId),
          );
          if (!conversation || conversation.widgetSessionId !== actorId) {
            throw new UnauthorizedError('Conversation is not available for this session');
          }

          hub.add({
            id: connectionId,
            kind: 'widget',
            tenantId,
            userId: actorId,
            conversationId,
            lastEventId: null,
            socket,
          });

          send(socket, {
            type: 'connected',
            connectionId,
            serverTime: new Date().toISOString(),
            lastEventId: null,
            heartbeatIntervalMs: PRESENCE_HEARTBEAT_INTERVAL_MS,
            replayed: 0,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to start widget realtime session';
          input.logger.warn('Widget realtime session failed', { tenantId, conversationId, message });
          send(socket, {
            type: 'error',
            code: 'REALTIME_CONNECT_FAILED',
            message: 'Failed to start realtime session',
          });
          socket.close();
        }
      }

      async function handleMessage(raw: string): Promise<void> {
        const parsed = parseClientMessage(raw);
        if (!parsed) {
          send(socket, { type: 'error', code: 'INVALID_MESSAGE', message: 'Unrecognized realtime message' });
          return;
        }

        if (!hub.get(connectionId)) {
          return;
        }

        if (parsed.type === 'heartbeat') {
          send(socket, { type: 'pong', serverTime: new Date().toISOString() });
          return;
        }

        const payload = {
          tenantId,
          conversationId,
          actorId,
          actorType: 'customer' as const,
          displayName,
        };
        if (parsed.type === 'typing.start') {
          await input.typing.start(payload);
        } else {
          await input.typing.stop(payload);
        }
      }
    },
  );
}

function parseClientMessage(
  raw: string,
): { readonly type: 'heartbeat' | 'typing.start' | 'typing.stop' } | undefined {
  try {
    const result = clientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

function send(socket: WebSocket, message: RealtimeServerMessage): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}
