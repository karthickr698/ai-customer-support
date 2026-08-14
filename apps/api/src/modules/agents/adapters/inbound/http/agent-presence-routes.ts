import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import { UnauthorizedError } from '../../../../organizations/domain/errors.js';
import type { ListAgentPresenceUseCase } from '../../../application/use-cases/list-and-set-agent-presence-use-cases.js';
import type { SetOwnAgentPresenceUseCase } from '../../../application/use-cases/list-and-set-agent-presence-use-cases.js';
import type { HeartbeatAgentPresenceUseCase } from '../../../application/use-cases/mutate-agent-presence-use-cases.js';
import { parseBody } from './parse-body.js';
import { setAgentPresenceBodySchema } from './agent-presence-schemas.js';

export type AuthenticatePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function registerAgentPresenceRoutes(
  app: FastifyInstance,
  useCases: {
    readonly listPresence: ListAgentPresenceUseCase;
    readonly setOwnPresence: SetOwnAgentPresenceUseCase;
    readonly heartbeat: HeartbeatAgentPresenceUseCase;
  },
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.CONVERSATION_READ);
  const tenantAuth = [authenticate, resolveTenant, requireRead];

  app.get(
    '/api/organizations/:organizationId/agents/presence',
    { preHandler: tenantAuth },
    async (request, reply) => {
      const result = await useCases.listPresence.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.put(
    '/api/organizations/:organizationId/agents/presence',
    { preHandler: tenantAuth },
    async (request, reply) => {
      const body = parseBody(setAgentPresenceBodySchema, request.body);
      const result = await useCases.setOwnPresence.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        status: body.status,
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/agents/presence/heartbeat',
    { preHandler: tenantAuth },
    async (request, reply) => {
      await useCases.heartbeat.execute({
        tenantId: requireTenantId(request),
        agentId: requireUserId(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(204).send();
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
