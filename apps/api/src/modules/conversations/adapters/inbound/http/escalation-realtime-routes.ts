import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import type { CreateEscalationRuleUseCase } from '../../../application/use-cases/create-escalation-rule-use-case.js';
import type { DeleteEscalationRuleUseCase } from '../../../application/use-cases/update-escalation-rule-use-case.js';
import type { EvaluateEscalationRulesUseCase } from '../../../application/use-cases/evaluate-escalation-rules-use-case.js';
import type { ListEscalationRulesUseCase } from '../../../application/use-cases/list-escalation-rules-use-case.js';
import type { ReplayRealtimeEventsUseCase } from '../../../application/use-cases/replay-realtime-events-use-case.js';
import type { UpdateEscalationRuleUseCase } from '../../../application/use-cases/update-escalation-rule-use-case.js';
import { parseBody } from './parse-body.js';
import {
  createEscalationRuleBodySchema,
  realtimeEventsQuerySchema,
  updateEscalationRuleBodySchema,
} from './escalation-realtime-schemas.js';

export type AuthenticatePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function registerEscalationAndRealtimeHttpRoutes(
  app: FastifyInstance,
  useCases: {
    readonly createEscalationRule: CreateEscalationRuleUseCase;
    readonly listEscalationRules: ListEscalationRulesUseCase;
    readonly updateEscalationRule: UpdateEscalationRuleUseCase;
    readonly deleteEscalationRule: DeleteEscalationRuleUseCase;
    readonly evaluateEscalationRules: EvaluateEscalationRulesUseCase;
    readonly replayRealtimeEvents: ReplayRealtimeEventsUseCase;
  },
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.CONVERSATION_READ);
  const requireEscalate = createRequirePermissionPreHandler(Permissions.CONVERSATION_ESCALATE);
  const tenantAuth = [authenticate, resolveTenant];

  app.get(
    '/api/organizations/:organizationId/escalation-rules',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.listEscalationRules.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    '/api/organizations/:organizationId/escalation-rules',
    { preHandler: [...tenantAuth, requireEscalate] },
    async (request, reply) => {
      const body = parseBody(createEscalationRuleBodySchema, request.body);
      const result = await useCases.createEscalationRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ...body,
      });
      return reply.status(201).send(result);
    },
  );

  app.patch(
    '/api/organizations/:organizationId/escalation-rules/:ruleId',
    { preHandler: [...tenantAuth, requireEscalate] },
    async (request, reply) => {
      const body = parseBody(updateEscalationRuleBodySchema, request.body);
      const result = await useCases.updateEscalationRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
        ...body,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    '/api/organizations/:organizationId/escalation-rules/:ruleId',
    { preHandler: [...tenantAuth, requireEscalate] },
    async (request, reply) => {
      await useCases.deleteEscalationRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/organizations/:organizationId/escalation-rules/evaluate',
    { preHandler: [...tenantAuth, requireEscalate] },
    async (request, reply) => {
      const result = await useCases.evaluateEscalationRules.execute({
        type: 'due',
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    '/api/organizations/:organizationId/realtime/events',
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(realtimeEventsQuerySchema, request.query);
      const result = await useCases.replayRealtimeEvents.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        afterEventId: query.after,
        limit: query.limit,
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
