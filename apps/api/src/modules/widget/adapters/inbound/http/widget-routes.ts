import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { GetPublicWidgetConfigurationUseCase } from '../../../application/use-cases/get-public-widget-configuration-use-case.js';
import type {
  GetWidgetConfigurationUseCase,
  RotateWidgetPublicKeyUseCase,
  UpdateWidgetConfigurationUseCase,
} from '../../../application/use-cases/manage-widget-configuration-use-cases.js';
import type {
  CreateWidgetSessionUseCase,
  GetWidgetSessionUseCase,
  IdentifyWidgetSessionUseCase,
} from '../../../application/use-cases/widget-session-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  createAuthenticateWidgetSessionPreHandler,
  readWidgetSessionToken,
  requestOrigin,
} from './authenticate-widget-session.js';
import { parseBody } from './parse-body.js';
import {
  createWidgetSessionBodySchema,
  identifyWidgetSessionBodySchema,
  updateWidgetConfigurationBodySchema,
} from './widget-schemas.js';
import type { ClockPort } from '../../../application/ports/clock-port.js';
import type { TokenHasherPort } from '../../../application/ports/security-ports.js';
import type { WidgetConfigurationRepository } from '../../../application/ports/widget-configuration-repository.js';
import type { WidgetSessionRepository } from '../../../application/ports/widget-session-repository.js';

export type AuthenticatePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export type WidgetHttpUseCases = {
  readonly getWidgetConfiguration: GetWidgetConfigurationUseCase;
  readonly updateWidgetConfiguration: UpdateWidgetConfigurationUseCase;
  readonly rotateWidgetPublicKey: RotateWidgetPublicKeyUseCase;
  readonly getPublicWidgetConfiguration: GetPublicWidgetConfigurationUseCase;
  readonly createWidgetSession: CreateWidgetSessionUseCase;
  readonly identifyWidgetSession: IdentifyWidgetSessionUseCase;
  readonly getWidgetSession: GetWidgetSessionUseCase;
};

export async function registerWidgetRoutes(
  app: FastifyInstance,
  useCases: WidgetHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
  sessionAuth: {
    readonly sessions: WidgetSessionRepository;
    readonly widgets: WidgetConfigurationRepository;
    readonly hasher: TokenHasherPort;
    readonly clock: ClockPort;
  },
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireUpdate = createRequirePermissionPreHandler(Permissions.ORGANIZATION_UPDATE);
  const tenantAuth = [authenticate, resolveTenant];
  const authenticateSession = createAuthenticateWidgetSessionPreHandler(sessionAuth);

  app.get(
    '/api/organizations/:organizationId/widget',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getWidgetConfiguration.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/widget',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(updateWidgetConfigurationBodySchema, request.body);
      const result = await useCases.updateWidgetConfiguration.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/widget/rotate-key',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const result = await useCases.rotateWidgetPublicKey.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get('/api/widget/:publicKey/config', async (request, reply) => {
    const result = await useCases.getPublicWidgetConfiguration.execute({
      publicKey: routeParam(request, 'publicKey'),
      origin: requestOrigin(request),
    });
    return reply.status(200).send(result);
  });

  app.post('/api/widget/:publicKey/sessions', async (request, reply) => {
    const body = parseBody(createWidgetSessionBodySchema, request.body ?? {});
    const result = await useCases.createWidgetSession.execute({
      publicKey: routeParam(request, 'publicKey'),
      visitorId: body.visitorId,
      email: body.email,
      name: body.name,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(
    '/api/widget/sessions/me',
    { preHandler: [authenticateSession] },
    async (request, reply) => {
      const token = readWidgetSessionToken(request);
      const result = await useCases.getWidgetSession.execute({
        sessionToken: token ?? '',
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/widget/sessions/identify',
    { preHandler: [authenticateSession] },
    async (request, reply) => {
      const body = parseBody(identifyWidgetSessionBodySchema, request.body);
      const token = readWidgetSessionToken(request);
      const result = await useCases.identifyWidgetSession.execute({
        sessionToken: token ?? '',
        email: body.email,
        name: body.name,
        security: securityContext(request),
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
    origin: requestOrigin(request),
  };
}
