import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '@ai-customer-support/shared';
import type { RealtimeClientMessage, RealtimeServerMessage } from '@ai-customer-support/contracts';
import type { RawData, WebSocket } from 'ws';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from '../../../../agents/domain/presence-constants.js';
import { REALTIME_REPLAY_LIMIT } from '../../../domain/support-constants.js';
import type { ListAgentPresenceUseCase } from '../../../../agents/application/use-cases/list-and-set-agent-presence-use-cases.js';
import type {
  ConnectAgentPresenceUseCase,
  DisconnectAgentPresenceUseCase,
  HeartbeatAgentPresenceUseCase,
  SetAgentPresenceStatusUseCase,
} from '../../../../agents/application/use-cases/mutate-agent-presence-use-cases.js';
import type { ReplayRealtimeEventsUseCase } from '../../../application/use-cases/replay-realtime-events-use-case.js';
import type { AuthenticatePreHandler } from '../http/conversation-routes.js';
import type { RealtimeConnectionHub } from './realtime-connection-hub.js';

const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heartbeat') }),
  z.object({ type: z.literal('resume'), lastEventId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('presence.set'), status: z.enum(['online', 'away', 'busy']) }),
  z.object({ type: z.literal('subscribe'), conversationId: z.string().uuid().optional() }),
  z.object({ type: z.literal('unsubscribe') }),
]);

export function withQueryAccessToken(authenticate: AuthenticatePreHandler): AuthenticatePreHandler {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = request.query as Record<string, unknown>;
    const token = typeof query.access_token === 'string' ? query.access_token : undefined;
    if (token && !request.headers.authorization && !request.cookies.access_token) {
      request.headers.authorization = `Bearer ${token}`;
    }

    await authenticate(request, reply);
  };
}

export async function registerRealtimeWebsocket(
  app: FastifyInstance,
  input: {
    readonly hub: RealtimeConnectionHub;
    readonly authenticate: AuthenticatePreHandler;
    readonly resolveTenantAccess: ResolveTenantAccessUseCase;
    readonly replayRealtimeEvents: ReplayRealtimeEventsUseCase;
    readonly listPresence: ListAgentPresenceUseCase;
    readonly connectPresence: ConnectAgentPresenceUseCase;
    readonly disconnectPresence: DisconnectAgentPresenceUseCase;
    readonly heartbeatPresence: HeartbeatAgentPresenceUseCase;
    readonly setPresence: SetAgentPresenceStatusUseCase;
    readonly logger: Logger;
  },
): Promise<void> {
  const authenticate = withQueryAccessToken(input.authenticate);
  const resolveTenant = createResolveTenantPreHandler(input.resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.CONVERSATION_READ);

  app.get(
    '/api/organizations/:organizationId/realtime',
    { websocket: true, preHandler: [authenticate, resolveTenant, requireRead] },
    (socket, request) => {
      const tenantId = request.tenantAccess?.tenantId;
      const userId = request.auth?.userId;
      if (!tenantId || !userId) {
        send(socket, { type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
        socket.close();
        return;
      }

      const sessionTenantId = tenantId;
      const sessionUserId = userId;
      const connectionId = crypto.randomUUID();
      const query = request.query as Record<string, unknown>;
      const resumeFrom = typeof query.lastEventId === 'string' ? query.lastEventId : undefined;
      const { hub } = input;

      hub.add({
        id: connectionId,
        tenantId: sessionTenantId,
        userId: sessionUserId,
        lastEventId: resumeFrom ?? null,
        socket,
      });

      void startSession();

      socket.on('message', (raw: RawData) => {
        void handleMessage(raw.toString());
      });

      socket.on('close', () => {
        hub.remove(connectionId);
        void input.disconnectPresence.execute({ tenantId: sessionTenantId, agentId: sessionUserId });
      });

      socket.on('error', (error: Error) => {
        input.logger.warn('Realtime socket error', {
          tenantId: sessionTenantId,
          actorId: sessionUserId,
          message: error.message,
        });
      });

      async function startSession(): Promise<void> {
        try {
          await input.connectPresence.execute({
            tenantId: sessionTenantId,
            agentId: sessionUserId,
            correlationId: request.requestContext.correlationId,
          });
          const replayed = await input.replayRealtimeEvents.execute({
            tenantId: sessionTenantId,
            actorId: sessionUserId,
            afterEventId: resumeFrom,
            limit: REALTIME_REPLAY_LIMIT,
          });
          const presence = await input.listPresence.execute({
            tenantId: sessionTenantId,
            actorId: sessionUserId,
          });

          if (replayed.resyncRequired) {
            send(socket, { type: 'resync_required', lastEventId: replayed.lastEventId });
          }

          send(socket, {
            type: 'connected',
            connectionId,
            serverTime: new Date().toISOString(),
            lastEventId: replayed.lastEventId,
            heartbeatIntervalMs: PRESENCE_HEARTBEAT_INTERVAL_MS,
            replayed: replayed.items.length,
          });

          for (const event of replayed.items) {
            send(socket, { type: 'event', event });
          }

          send(socket, { type: 'presence.snapshot', items: presence.items });
          const connection = hub.get(connectionId);
          if (connection) {
            connection.lastEventId = replayed.lastEventId;
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to start realtime session';
          input.logger.warn('Realtime session failed', {
            tenantId: sessionTenantId,
            actorId: sessionUserId,
            message,
          });
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

        const connection = hub.get(connectionId);
        if (!connection) {
          return;
        }

        const correlationId = request.requestContext.correlationId;

        try {
          switch (parsed.type) {
            case 'heartbeat':
              await input.heartbeatPresence.execute({
                tenantId: sessionTenantId,
                agentId: sessionUserId,
                correlationId,
              });
              send(socket, { type: 'pong', serverTime: new Date().toISOString() });
              break;
            case 'presence.set':
              await input.setPresence.execute({
                tenantId: sessionTenantId,
                agentId: sessionUserId,
                status: parsed.status,
                correlationId,
              });
              break;
            case 'subscribe':
              connection.conversationId = parsed.conversationId;
              break;
            case 'unsubscribe':
              connection.conversationId = undefined;
              break;
            case 'resume': {
              const replayed = await input.replayRealtimeEvents.execute({
                tenantId: sessionTenantId,
                actorId: sessionUserId,
                afterEventId: parsed.lastEventId,
                limit: REALTIME_REPLAY_LIMIT,
              });
              if (replayed.resyncRequired) {
                send(socket, { type: 'resync_required', lastEventId: replayed.lastEventId });
                break;
              }

              for (const event of replayed.items) {
                send(socket, { type: 'event', event });
              }

              connection.lastEventId = replayed.lastEventId;
              break;
            }
          }
        } catch {
          send(socket, { type: 'error', code: 'REALTIME_COMMAND_FAILED', message: 'Realtime command failed' });
        }
      }
    },
  );
}

function parseClientMessage(raw: string): RealtimeClientMessage | undefined {
  try {
    const result = clientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

function send(
  socket: WebSocket,
  message: RealtimeServerMessage,
): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}
