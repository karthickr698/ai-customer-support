import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  DispatchNotificationsUseCase,
  GetNotificationDeliveryUseCase,
  ListNotificationAttemptsUseCase,
  ListNotificationDeliveriesUseCase,
  RetryNotificationDeliveryUseCase,
} from '../../../application/use-cases/delivery-use-cases.js';
import type {
  ListNotificationInboxUseCase,
  MarkInboxItemReadUseCase,
  MarkInboxReadAllUseCase,
} from '../../../application/use-cases/inbox-use-cases.js';
import type {
  ListNotificationPreferencesUseCase,
  UpsertNotificationPreferencesUseCase,
} from '../../../application/use-cases/preference-use-cases.js';
import type { SendNotificationUseCase } from '../../../application/use-cases/send-notification-use-case.js';
import type {
  CreateNotificationTemplateUseCase,
  DeleteNotificationTemplateUseCase,
  GetNotificationTemplateUseCase,
  ListNotificationTemplatesUseCase,
  UpdateNotificationTemplateUseCase,
} from '../../../application/use-cases/template-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  createNotificationTemplateBodySchema,
  notificationAttemptListQuerySchema,
  notificationDeliveryListQuerySchema,
  notificationInboxListQuerySchema,
  notificationPreferenceQuerySchema,
  sendNotificationBodySchema,
  updateNotificationTemplateBodySchema,
  upsertNotificationPreferencesBodySchema,
} from './notification-schemas.js';
import { parseBody } from './parse-body.js';

export type NotificationHttpUseCases = {
  readonly createTemplate: CreateNotificationTemplateUseCase;
  readonly listTemplates: ListNotificationTemplatesUseCase;
  readonly getTemplate: GetNotificationTemplateUseCase;
  readonly updateTemplate: UpdateNotificationTemplateUseCase;
  readonly deleteTemplate: DeleteNotificationTemplateUseCase;
  readonly listPreferences: ListNotificationPreferencesUseCase;
  readonly upsertPreferences: UpsertNotificationPreferencesUseCase;
  readonly send: SendNotificationUseCase;
  readonly listDeliveries: ListNotificationDeliveriesUseCase;
  readonly getDelivery: GetNotificationDeliveryUseCase;
  readonly retryDelivery: RetryNotificationDeliveryUseCase;
  readonly listAttempts: ListNotificationAttemptsUseCase;
  readonly dispatch: DispatchNotificationsUseCase;
  readonly listInbox: ListNotificationInboxUseCase;
  readonly markInboxRead: MarkInboxItemReadUseCase;
  readonly markInboxReadAll: MarkInboxReadAllUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerNotificationRoutes(
  app: FastifyInstance,
  useCases: NotificationHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.NOTIFICATION_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.NOTIFICATION_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const org = '/api/organizations/:organizationId';

  app.post(
    `${org}/notification-templates`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(createNotificationTemplateBodySchema, request.body);
      const result = await useCases.createTemplate.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    },
  );

  app.get(
    `${org}/notification-templates`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listTemplates.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/notification-templates/:templateId`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getTemplate.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        templateId: routeParam(request, 'templateId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    `${org}/notification-templates/:templateId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(updateNotificationTemplateBodySchema, request.body);
      const result = await useCases.updateTemplate.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        templateId: routeParam(request, 'templateId'),
        ...body,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/notification-templates/:templateId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteTemplate.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        templateId: routeParam(request, 'templateId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.get(
    `${org}/notification-preferences`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(notificationPreferenceQuerySchema, request.query);
      const result = await useCases.listPreferences.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        subjectType: query.subjectType,
        subjectKey: query.subjectKey,
      });
      return reply.status(200).send(result);
    },
  );

  app.put(
    `${org}/notification-preferences`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const body = parseBody(upsertNotificationPreferencesBodySchema, request.body);
      const result = await useCases.upsertPreferences.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(`${org}/notifications`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(sendNotificationBodySchema, request.body);
    const result = await useCases.send.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...body,
      security: securityContext(request),
    });
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.post(
    `${org}/notifications/dispatch`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.dispatch.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/notifications/inbox`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(notificationInboxListQuerySchema, request.query);
      const result = await useCases.listInbox.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        unreadOnly: query.unreadOnly,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/notifications/inbox/read-all`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.markInboxReadAll.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/notifications/inbox/:itemId/read`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.markInboxRead.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        itemId: routeParam(request, 'itemId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/notification-deliveries`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(notificationDeliveryListQuerySchema, request.query);
      const result = await useCases.listDeliveries.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        templateId: query.templateId,
        status: query.status,
        channel: query.channel,
        recipient: query.recipient,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/notification-deliveries/:deliveryId`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getDelivery.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        deliveryId: routeParam(request, 'deliveryId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/notification-deliveries/:deliveryId/retry`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.retryDelivery.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        deliveryId: routeParam(request, 'deliveryId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/notification-deliveries/:deliveryId/attempts`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(notificationAttemptListQuerySchema, request.query);
      const result = await useCases.listAttempts.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        deliveryId: routeParam(request, 'deliveryId'),
        status: query.status,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/notification-attempts`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(notificationAttemptListQuerySchema, request.query);
      const result = await useCases.listAttempts.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        deliveryId: query.deliveryId,
        status: query.status,
      });
      return reply.status(200).send(result);
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
  };
}
