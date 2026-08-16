import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  GetAiAgentConfigurationUseCase,
  UpdateAiAgentConfigurationUseCase,
} from '../../../application/use-cases/manage-ai-agent-configuration-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { updateAiAgentConfigurationBodySchema } from './ai-agent-configuration-schemas.js';
import { parseBody } from './parse-body.js';

export type AuthenticatePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export type AiAgentConfigurationHttpUseCases = {
  readonly getConfiguration: GetAiAgentConfigurationUseCase;
  readonly updateConfiguration: UpdateAiAgentConfigurationUseCase;
};

export async function registerAiAgentConfigurationRoutes(
  app: FastifyInstance,
  useCases: AiAgentConfigurationHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.ORGANIZATION_READ);
  const requireUpdate = createRequirePermissionPreHandler(Permissions.ORGANIZATION_UPDATE);
  const tenantAuth = [authenticate, resolveTenant];

  app.get(
    '/api/organizations/:organizationId/ai-agent',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getConfiguration.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/ai-agent',
    { preHandler: [...tenantAuth, requireUpdate] },
    async (request, reply) => {
      const body = parseBody(updateAiAgentConfigurationBodySchema, request.body);
      const result = await useCases.updateConfiguration.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
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

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
