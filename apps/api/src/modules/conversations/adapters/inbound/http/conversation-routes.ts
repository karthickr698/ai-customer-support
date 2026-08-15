import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { AddConversationNoteUseCase } from '../../../application/use-cases/add-conversation-note-use-case.js';
import type { AddConversationTagUseCase } from '../../../application/use-cases/add-conversation-tag-use-case.js';
import type { AssignConversationUseCase } from '../../../application/use-cases/assign-conversation-use-case.js';
import type { AssignToAvailableAgentUseCase } from '../../../application/use-cases/assign-to-available-agent-use-case.js';
import type { ChangeConversationStatusUseCase } from '../../../application/use-cases/change-conversation-status-use-case.js';
import type { CreateConversationUseCase } from '../../../application/use-cases/create-conversation-use-case.js';
import type { EscalateConversationUseCase } from '../../../application/use-cases/escalate-conversation-use-case.js';
import type { GetConversationUseCase } from '../../../application/use-cases/get-conversation-use-case.js';
import type { ListConversationNotesUseCase } from '../../../application/use-cases/list-conversation-notes-use-case.js';
import type { ListConversationsUseCase } from '../../../application/use-cases/list-conversations-use-case.js';
import type { ListMessagesUseCase } from '../../../application/use-cases/list-messages-use-case.js';
import type { RemoveConversationTagUseCase } from '../../../application/use-cases/remove-conversation-tag-use-case.js';
import type { SendMessageUseCase } from '../../../application/use-cases/send-message-use-case.js';
import type { UnassignConversationUseCase } from '../../../application/use-cases/unassign-conversation-use-case.js';
import type { GetConversationAttachmentUseCase, UploadConversationAttachmentUseCase } from '../../../application/use-cases/attachment-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { readUploadedFile } from './read-uploaded-file.js';
import {
  addConversationNoteBodySchema,
  addConversationTagBodySchema,
  assignConversationBodySchema,
  changeConversationStatusBodySchema,
  conversationListQuerySchema,
  conversationPageQuerySchema,
  createConversationBodySchema,
  escalateConversationBodySchema,
  sendMessageBodySchema,
} from './conversation-schemas.js';
import { parseBody } from './parse-body.js';

export type ConversationHttpUseCases = {
  readonly createConversation: CreateConversationUseCase;
  readonly listConversations: ListConversationsUseCase;
  readonly getConversation: GetConversationUseCase;
  readonly changeConversationStatus: ChangeConversationStatusUseCase;
  readonly assignConversation: AssignConversationUseCase;
  readonly assignToAvailableAgent: AssignToAvailableAgentUseCase;
  readonly unassignConversation: UnassignConversationUseCase;
  readonly escalateConversation: EscalateConversationUseCase;
  readonly addConversationTag: AddConversationTagUseCase;
  readonly removeConversationTag: RemoveConversationTagUseCase;
  readonly sendMessage: SendMessageUseCase;
  readonly listMessages: ListMessagesUseCase;
  readonly addConversationNote: AddConversationNoteUseCase;
  readonly listConversationNotes: ListConversationNotesUseCase;
  readonly uploadConversationAttachment: UploadConversationAttachmentUseCase;
  readonly getConversationAttachment: GetConversationAttachmentUseCase;
};

export type AuthenticatePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function registerConversationRoutes(
  app: FastifyInstance,
  useCases: ConversationHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.CONVERSATION_READ);
  const requireWrite = createRequirePermissionPreHandler(Permissions.CONVERSATION_WRITE);
  const requireAssign = createRequirePermissionPreHandler(Permissions.CONVERSATION_ASSIGN);
  const requireEscalate = createRequirePermissionPreHandler(Permissions.CONVERSATION_ESCALATE);
  const tenantAuth = [authenticate, resolveTenant];

  app.post(
    '/api/organizations/:organizationId/conversations',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(createConversationBodySchema, request.body);
      const result = await useCases.createConversation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        customerId: body.customerId,
        subject: body.subject,
        channel: body.channel,
        tags: body.tags,
        assignedAgentId: body.assignedAgentId,
        initialMessage: body.initialMessage,
        initialMessageAuthor: body.initialMessageAuthor,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/conversations',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(conversationListQuerySchema, request.query);
      const result = await useCases.listConversations.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        query: query.q,
        status: query.status,
        assignedAgentId: query.assignedAgentId,
        tag: query.tag,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/conversations/:conversationId',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getConversation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/conversations/:conversationId/status',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(changeConversationStatusBodySchema, request.body);
      const result = await useCases.changeConversationStatus.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        status: body.status,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/assign',
    { preHandler: [...tenantAuth, requireAssign] },
    async (request, reply) => {
      const body = parseBody(assignConversationBodySchema, request.body);
      const result = await useCases.assignConversation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        assignedAgentId: body.assignedAgentId,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/assign/available',
    { preHandler: [...tenantAuth, requireAssign] },
    async (request, reply) => {
      const result = await useCases.assignToAvailableAgent.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/unassign',
    { preHandler: [...tenantAuth, requireAssign] },
    async (request, reply) => {
      const result = await useCases.unassignConversation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/escalate',
    { preHandler: [...tenantAuth, requireEscalate] },
    async (request, reply) => {
      const body = parseBody(escalateConversationBodySchema, request.body ?? {});
      const result = await useCases.escalateConversation.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        reason: body.reason,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/tags',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(addConversationTagBodySchema, request.body);
      const result = await useCases.addConversationTag.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        name: body.name,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/conversations/:conversationId/tags/:tag',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const result = await useCases.removeConversationTag.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        name: decodeURIComponent(routeParam(request, 'tag')),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/conversations/:conversationId/messages',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(conversationPageQuerySchema, request.query);
      const result = await useCases.listMessages.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/messages',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(sendMessageBodySchema, request.body);
      const result = await useCases.sendMessage.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        body: body.body,
        authorType: body.authorType,
        attachmentIds: body.attachmentIds,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/conversations/:conversationId/notes',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(conversationPageQuerySchema, request.query);
      const result = await useCases.listConversationNotes.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        page: { page: query.page, pageSize: query.pageSize },
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/notes',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const body = parseBody(addConversationNoteBodySchema, request.body);
      const result = await useCases.addConversationNote.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        conversationId: routeParam(request, 'conversationId'),
        body: body.body,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/conversations/:conversationId/attachments',
    { preHandler: [...tenantAuth, requireWrite] },
    async (request, reply) => {
      const file = await readUploadedFile(request);
      const result = await useCases.uploadConversationAttachment.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
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
    '/api/organizations/:organizationId/conversations/:conversationId/attachments/:attachmentId',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getConversationAttachment.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
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

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }

  return request.auth.userId;
}

function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantAccess?.tenantId ?? request.requestContext.tenantId;
  if (!tenantId) {
    throw new UnauthorizedError('Select an organization to continue');
  }

  return tenantId;
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
    traceId: request.requestContext.traceId,
    spanId: request.requestContext.spanId,
  };
}
