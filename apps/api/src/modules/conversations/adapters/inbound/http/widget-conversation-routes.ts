import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { ChangeWidgetConversationStatusUseCase } from '../../../application/use-cases/change-widget-conversation-status-use-case.js';
import type {
  GetWidgetAttachmentUseCase,
  UploadWidgetAttachmentUseCase,
} from '../../../application/use-cases/attachment-use-cases.js';
import type {
  GetWidgetConversationUseCase,
  ListWidgetConversationsUseCase,
} from '../../../application/use-cases/list-widget-conversations-use-case.js';
import type { ListWidgetMessagesUseCase } from '../../../application/use-cases/list-widget-messages-use-case.js';
import type { SendWidgetMessageUseCase } from '../../../application/use-cases/send-widget-message-use-case.js';
import type { StartWidgetConversationUseCase } from '../../../application/use-cases/start-widget-conversation-use-case.js';
import type { StreamWidgetAiReplyUseCase } from '../../../application/use-cases/stream-widget-ai-reply-use-case.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { conversationPageQuerySchema } from './conversation-schemas.js';
import { parseBody } from './parse-body.js';
import { readUploadedFile } from './read-uploaded-file.js';
import { widgetConversationBodySchema, widgetMessageBodySchema, widgetStatusBodySchema } from './widget-conversation-schemas.js';

export type WidgetConversationHttpUseCases = {
  readonly startWidgetConversation: StartWidgetConversationUseCase;
  readonly listWidgetConversations: ListWidgetConversationsUseCase;
  readonly getWidgetConversation: GetWidgetConversationUseCase;
  readonly changeWidgetConversationStatus: ChangeWidgetConversationStatusUseCase;
  readonly sendWidgetMessage: SendWidgetMessageUseCase;
  readonly listWidgetMessages: ListWidgetMessagesUseCase;
  readonly streamWidgetAiReply: StreamWidgetAiReplyUseCase;
  readonly uploadWidgetAttachment: UploadWidgetAttachmentUseCase;
  readonly getWidgetAttachment: GetWidgetAttachmentUseCase;
};

export type WidgetAuthenticatePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function registerWidgetConversationRoutes(
  app: FastifyInstance,
  useCases: WidgetConversationHttpUseCases,
  authenticateWidgetSession: WidgetAuthenticatePreHandler,
): Promise<void> {
  const sessionAuth = [authenticateWidgetSession];

  app.post(
    '/api/widget/conversations',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const body = parseBody(widgetConversationBodySchema, request.body ?? {});
      const result = await useCases.startWidgetConversation.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        subject: body.subject,
        message: body.message,
        attachmentIds: body.attachmentIds,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/widget/conversations',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const query = parseBody(conversationPageQuerySchema, request.query);
      const result = await useCases.listWidgetConversations.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/widget/conversations/:conversationId',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const result = await useCases.getWidgetConversation.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        conversationId: routeParam(request, 'conversationId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/widget/conversations/:conversationId/status',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const body = parseBody(widgetStatusBodySchema, request.body);
      const result = await useCases.changeWidgetConversationStatus.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        conversationId: routeParam(request, 'conversationId'),
        status: body.status,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/widget/conversations/:conversationId/messages',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const query = parseBody(conversationPageQuerySchema, request.query);
      const result = await useCases.listWidgetMessages.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        conversationId: routeParam(request, 'conversationId'),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/widget/conversations/:conversationId/messages',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const body = parseBody(widgetMessageBodySchema, request.body ?? {});
      const result = await useCases.sendWidgetMessage.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        conversationId: routeParam(request, 'conversationId'),
        body: body.body,
        attachmentIds: body.attachmentIds,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/api/widget/conversations/:conversationId/messages/stream',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const body = parseBody(widgetMessageBodySchema, request.body ?? {});
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        for await (const event of useCases.streamWidgetAiReply.execute({
          sessionToken: requireSessionToken(request),
          origin: requestOrigin(request),
          conversationId: routeParam(request, 'conversationId'),
          body: body.body,
          attachmentIds: body.attachmentIds,
          security: securityContext(request),
        })) {
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Streaming failed';
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'STREAM_ERROR';
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ type: 'error', code, message })}\n\n`,
        );
      } finally {
        reply.raw.end();
      }
    },
  );

  app.post(
    '/api/widget/conversations/:conversationId/attachments',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const file = await readUploadedFile(request);
      const result = await useCases.uploadWidgetAttachment.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        conversationId: routeParam(request, 'conversationId'),
        fileName: file.fileName,
        contentType: file.contentType,
        bytes: file.bytes,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/widget/conversations/:conversationId/attachments/:attachmentId',
    { preHandler: sessionAuth },
    async (request, reply) => {
      const result = await useCases.getWidgetAttachment.execute({
        sessionToken: requireSessionToken(request),
        origin: requestOrigin(request),
        conversationId: routeParam(request, 'conversationId'),
        attachmentId: routeParam(request, 'attachmentId'),
      });
      return reply
        .header('content-type', result.contentType)
        .header('content-disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`)
        .status(200)
        .send(result.bytes);
    },
  );
}

function requireSessionToken(request: FastifyRequest): string {
  const header = request.headers['x-widget-session'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }

  const authorization = request.headers.authorization;
  if (authorization) {
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token;
    }
  }

  throw new UnauthorizedError('Widget session token required');
}

function requestOrigin(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : undefined;
}

function routeParam(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
