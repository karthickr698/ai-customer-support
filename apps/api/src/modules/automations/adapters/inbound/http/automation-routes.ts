import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  DispatchAutomationsUseCase,
  GetAutomationJobUseCase,
  ListAutomationJobsUseCase,
  ListAutomationLogsUseCase,
  RetryAutomationJobUseCase,
  RunAutomationUseCase,
} from '../../../application/use-cases/job-use-cases.js';
import type {
  CreateAutomationRuleUseCase,
  DeleteAutomationRuleUseCase,
  GetAutomationRuleUseCase,
  ListAutomationRulesUseCase,
  SetAutomationRuleEnabledUseCase,
  UpdateAutomationRuleUseCase,
} from '../../../application/use-cases/rule-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  automationJobListQuerySchema,
  automationLogListQuerySchema,
  createAutomationRuleBodySchema,
  runAutomationBodySchema,
  updateAutomationRuleBodySchema,
} from './automation-schemas.js';
import { parseBody } from './parse-body.js';

export type AutomationHttpUseCases = {
  readonly createRule: CreateAutomationRuleUseCase;
  readonly listRules: ListAutomationRulesUseCase;
  readonly getRule: GetAutomationRuleUseCase;
  readonly updateRule: UpdateAutomationRuleUseCase;
  readonly deleteRule: DeleteAutomationRuleUseCase;
  readonly setEnabled: SetAutomationRuleEnabledUseCase;
  readonly runRule: RunAutomationUseCase;
  readonly listJobs: ListAutomationJobsUseCase;
  readonly getJob: GetAutomationJobUseCase;
  readonly retryJob: RetryAutomationJobUseCase;
  readonly listLogs: ListAutomationLogsUseCase;
  readonly dispatch: DispatchAutomationsUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerAutomationRoutes(
  app: FastifyInstance,
  useCases: AutomationHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireRead = createRequirePermissionPreHandler(Permissions.AUTOMATION_READ);
  const requireManage = createRequirePermissionPreHandler(Permissions.AUTOMATION_MANAGE);
  const tenantAuth = [authenticate, resolveTenant];
  const org = '/api/organizations/:organizationId';

  app.post(`${org}/automations`, { preHandler: [...tenantAuth, requireManage] }, async (request, reply) => {
    const body = parseBody(createAutomationRuleBodySchema, request.body);
    const result = await useCases.createRule.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...body,
      security: securityContext(request),
    });
    return reply.status(201).send(result);
  });

  app.get(`${org}/automations`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const result = await useCases.listRules.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
    });
    return reply.status(200).send(result);
  });

  app.post(
    `${org}/automations/dispatch`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.dispatch.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(`${org}/automation-jobs`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(automationJobListQuerySchema, request.query);
    const result = await useCases.listJobs.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      ruleId: query.ruleId,
      status: query.status,
    });
    return reply.status(200).send(result);
  });

  app.get(
    `${org}/automation-jobs/:jobId`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getJob.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        jobId: routeParam(request, 'jobId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/automation-jobs/:jobId/retry`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.retryJob.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        jobId: routeParam(request, 'jobId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.get(`${org}/automation-logs`, { preHandler: [...tenantAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(automationLogListQuerySchema, request.query);
    const result = await useCases.listLogs.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      ruleId: query.ruleId,
      jobId: query.jobId,
      status: query.status,
    });
    return reply.status(200).send(result);
  });

  app.get(
    `${org}/automations/:ruleId`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const result = await useCases.getRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.patch(
    `${org}/automations/:ruleId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(updateAutomationRuleBodySchema, request.body);
      const result = await useCases.updateRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
        ...body,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${org}/automations/:ruleId`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      await useCases.deleteRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    },
  );

  app.post(
    `${org}/automations/:ruleId/enable`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.setEnabled.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
        enabled: true,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/automations/:ruleId/disable`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const result = await useCases.setEnabled.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
        enabled: false,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${org}/automations/:ruleId/run`,
    { preHandler: [...tenantAuth, requireManage] },
    async (request, reply) => {
      const body = parseBody(runAutomationBodySchema, request.body ?? {});
      const result = await useCases.runRule.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        ruleId: routeParam(request, 'ruleId'),
        idempotencyKey: body.idempotencyKey,
        payload: body.payload,
        security: securityContext(request),
      });
      return reply.status(result.created ? 201 : 200).send(result);
    },
  );

  app.get(
    `${org}/automations/:ruleId/jobs`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(automationJobListQuerySchema, request.query);
      const result = await useCases.listJobs.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        ruleId: routeParam(request, 'ruleId'),
        status: query.status,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${org}/automations/:ruleId/logs`,
    { preHandler: [...tenantAuth, requireRead] },
    async (request, reply) => {
      const query = parseBody(automationLogListQuerySchema, request.query);
      const result = await useCases.listLogs.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        page: { page: query.page, pageSize: query.pageSize },
        ruleId: routeParam(request, 'ruleId'),
        jobId: query.jobId,
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
