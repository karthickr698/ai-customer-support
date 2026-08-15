import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { ListOperationalAuditLogsUseCase } from '../../../application/use-cases/audit-use-cases.js';
import type {
  CreateFeatureFlagUseCase,
  DeleteFeatureFlagUseCase,
  EvaluateFeatureFlagUseCase,
  GetFeatureFlagUseCase,
  ListFeatureFlagsUseCase,
  RemoveFeatureFlagOverrideUseCase,
  SetFeatureFlagOverrideUseCase,
  UpdateFeatureFlagUseCase,
} from '../../../application/use-cases/feature-flag-use-cases.js';
import type { GetPlatformHealthUseCase } from '../../../application/use-cases/health-use-case.js';
import type {
  BootstrapPlatformOwnerUseCase,
  ChangePlatformOperatorRoleUseCase,
  GetCurrentPlatformOperatorUseCase,
  GrantPlatformOperatorUseCase,
  ListPlatformOperatorsUseCase,
  LoadPlatformActorService,
  RevokePlatformOperatorUseCase,
} from '../../../application/use-cases/operator-use-cases.js';
import type {
  ActivatePlatformTenantUseCase,
  GetPlatformTenantUseCase,
  ListPlatformTenantsUseCase,
  SuspendPlatformTenantUseCase,
} from '../../../application/use-cases/tenant-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { PlatformPermissions } from '../../../domain/permissions.js';
import { parseBody } from './parse-body.js';
import {
  auditLogQuerySchema,
  changeOperatorRoleBodySchema,
  createFeatureFlagBodySchema,
  evaluateFeatureFlagQuerySchema,
  grantOperatorBodySchema,
  operatorListQuerySchema,
  setFeatureFlagOverrideBodySchema,
  tenantListQuerySchema,
  updateFeatureFlagBodySchema,
} from './platform-schemas.js';
import {
  createRequirePlatformPermissionPreHandler,
  createResolvePlatformOperatorPreHandler,
} from './require-platform-permission.js';

export type PlatformHttpUseCases = {
  readonly getMe: GetCurrentPlatformOperatorUseCase;
  readonly bootstrap: BootstrapPlatformOwnerUseCase;
  readonly listOperators: ListPlatformOperatorsUseCase;
  readonly grantOperator: GrantPlatformOperatorUseCase;
  readonly changeOperatorRole: ChangePlatformOperatorRoleUseCase;
  readonly revokeOperator: RevokePlatformOperatorUseCase;
  readonly listTenants: ListPlatformTenantsUseCase;
  readonly getTenant: GetPlatformTenantUseCase;
  readonly suspendTenant: SuspendPlatformTenantUseCase;
  readonly activateTenant: ActivatePlatformTenantUseCase;
  readonly listFlags: ListFeatureFlagsUseCase;
  readonly getFlag: GetFeatureFlagUseCase;
  readonly createFlag: CreateFeatureFlagUseCase;
  readonly updateFlag: UpdateFeatureFlagUseCase;
  readonly deleteFlag: DeleteFeatureFlagUseCase;
  readonly setFlagOverride: SetFeatureFlagOverrideUseCase;
  readonly removeFlagOverride: RemoveFeatureFlagOverrideUseCase;
  readonly evaluateFlag: EvaluateFeatureFlagUseCase;
  readonly getHealth: GetPlatformHealthUseCase;
  readonly listAuditLogs: ListOperationalAuditLogsUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerPlatformRoutes(
  app: FastifyInstance,
  useCases: PlatformHttpUseCases,
  authenticate: AuthenticatePreHandler,
  actors: LoadPlatformActorService,
): Promise<void> {
  const resolveOperator = createResolvePlatformOperatorPreHandler(actors);
  const requireOperatorsRead = createRequirePlatformPermissionPreHandler(PlatformPermissions.OPERATORS_READ);
  const requireOperatorsManage = createRequirePlatformPermissionPreHandler(PlatformPermissions.OPERATORS_MANAGE);
  const requireTenantsRead = createRequirePlatformPermissionPreHandler(PlatformPermissions.TENANTS_READ);
  const requireTenantsManage = createRequirePlatformPermissionPreHandler(PlatformPermissions.TENANTS_MANAGE);
  const requireFlagsRead = createRequirePlatformPermissionPreHandler(PlatformPermissions.FEATURE_FLAGS_READ);
  const requireFlagsManage = createRequirePlatformPermissionPreHandler(PlatformPermissions.FEATURE_FLAGS_MANAGE);
  const requireHealthRead = createRequirePlatformPermissionPreHandler(PlatformPermissions.HEALTH_READ);
  const requireAuditView = createRequirePlatformPermissionPreHandler(PlatformPermissions.AUDIT_VIEW);
  const operatorAuth = [authenticate, resolveOperator];
  const base = '/api/platform';

  app.get(`${base}/me`, { preHandler: [authenticate] }, async (request, reply) => {
    const result = await useCases.getMe.execute({ actorId: requireUserId(request) });
    return reply.status(200).send(result);
  });

  app.post(`${base}/bootstrap`, { preHandler: [authenticate] }, async (request, reply) => {
    const result = await useCases.bootstrap.execute({
      actorId: requireUserId(request),
      security: securityContext(request),
      correlationId: request.requestContext.correlationId,
    });
    return reply.status(201).send(result);
  });

  app.get(`${base}/operators`, { preHandler: [...operatorAuth, requireOperatorsRead] }, async (request, reply) => {
    const query = parseBody(operatorListQuerySchema, request.query);
    const result = await useCases.listOperators.execute({
      actorId: requireUserId(request),
      includeRevoked: query.includeRevoked,
    });
    return reply.status(200).send(result);
  });

  app.post(`${base}/operators`, { preHandler: [...operatorAuth, requireOperatorsManage] }, async (request, reply) => {
    const body = parseBody(grantOperatorBodySchema, request.body);
    const result = await useCases.grantOperator.execute({
      actorId: requireUserId(request),
      email: body.email,
      role: body.role,
      security: securityContext(request),
      correlationId: request.requestContext.correlationId,
    });
    return reply.status(201).send(result);
  });

  app.patch(
    `${base}/operators/:userId`,
    { preHandler: [...operatorAuth, requireOperatorsManage] },
    async (request, reply) => {
      const body = parseBody(changeOperatorRoleBodySchema, request.body);
      const result = await useCases.changeOperatorRole.execute({
        actorId: requireUserId(request),
        userId: routeParam(request, 'userId'),
        role: body.role,
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${base}/operators/:userId`,
    { preHandler: [...operatorAuth, requireOperatorsManage] },
    async (request, reply) => {
      const result = await useCases.revokeOperator.execute({
        actorId: requireUserId(request),
        userId: routeParam(request, 'userId'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(`${base}/tenants`, { preHandler: [...operatorAuth, requireTenantsRead] }, async (request, reply) => {
    const query = parseBody(tenantListQuerySchema, request.query);
    const result = await useCases.listTenants.execute({
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      status: query.status,
      query: query.q,
    });
    return reply.status(200).send(result);
  });

  app.get(
    `${base}/tenants/:organizationId`,
    { preHandler: [...operatorAuth, requireTenantsRead] },
    async (request, reply) => {
      const result = await useCases.getTenant.execute({
        actorId: requireUserId(request),
        organizationId: routeParam(request, 'organizationId'),
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${base}/tenants/:organizationId/suspend`,
    { preHandler: [...operatorAuth, requireTenantsManage] },
    async (request, reply) => {
      const result = await useCases.suspendTenant.execute({
        actorId: requireUserId(request),
        organizationId: routeParam(request, 'organizationId'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.post(
    `${base}/tenants/:organizationId/activate`,
    { preHandler: [...operatorAuth, requireTenantsManage] },
    async (request, reply) => {
      const result = await useCases.activateTenant.execute({
        actorId: requireUserId(request),
        organizationId: routeParam(request, 'organizationId'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(`${base}/feature-flags`, { preHandler: [...operatorAuth, requireFlagsRead] }, async (request, reply) => {
    const result = await useCases.listFlags.execute({ actorId: requireUserId(request) });
    return reply.status(200).send(result);
  });

  app.post(`${base}/feature-flags`, { preHandler: [...operatorAuth, requireFlagsManage] }, async (request, reply) => {
    const body = parseBody(createFeatureFlagBodySchema, request.body);
    const result = await useCases.createFlag.execute({
      actorId: requireUserId(request),
      key: body.key,
      description: body.description,
      enabled: body.enabled,
      security: securityContext(request),
      correlationId: request.requestContext.correlationId,
    });
    return reply.status(201).send(result);
  });

  app.get(
    `${base}/feature-flags/:key`,
    { preHandler: [...operatorAuth, requireFlagsRead] },
    async (request, reply) => {
      const result = await useCases.getFlag.execute({
        actorId: requireUserId(request),
        key: routeParam(request, 'key'),
      });
      return reply.status(200).send(result);
    },
  );

  app.put(
    `${base}/feature-flags/:key`,
    { preHandler: [...operatorAuth, requireFlagsManage] },
    async (request, reply) => {
      const body = parseBody(updateFeatureFlagBodySchema, request.body);
      const result = await useCases.updateFlag.execute({
        actorId: requireUserId(request),
        key: routeParam(request, 'key'),
        description: body.description,
        enabled: body.enabled,
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${base}/feature-flags/:key`,
    { preHandler: [...operatorAuth, requireFlagsManage] },
    async (request, reply) => {
      const result = await useCases.deleteFlag.execute({
        actorId: requireUserId(request),
        key: routeParam(request, 'key'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.put(
    `${base}/feature-flags/:key/overrides/:organizationId`,
    { preHandler: [...operatorAuth, requireFlagsManage] },
    async (request, reply) => {
      const body = parseBody(setFeatureFlagOverrideBodySchema, request.body);
      const result = await useCases.setFlagOverride.execute({
        actorId: requireUserId(request),
        key: routeParam(request, 'key'),
        organizationId: routeParam(request, 'organizationId'),
        enabled: body.enabled,
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.delete(
    `${base}/feature-flags/:key/overrides/:organizationId`,
    { preHandler: [...operatorAuth, requireFlagsManage] },
    async (request, reply) => {
      const result = await useCases.removeFlagOverride.execute({
        actorId: requireUserId(request),
        key: routeParam(request, 'key'),
        organizationId: routeParam(request, 'organizationId'),
        security: securityContext(request),
        correlationId: request.requestContext.correlationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(
    `${base}/feature-flags/:key/evaluation`,
    { preHandler: [...operatorAuth, requireFlagsRead] },
    async (request, reply) => {
      const query = parseBody(evaluateFeatureFlagQuerySchema, request.query);
      const result = await useCases.evaluateFlag.execute({
        actorId: requireUserId(request),
        key: routeParam(request, 'key'),
        organizationId: query.organizationId,
      });
      return reply.status(200).send(result);
    },
  );

  app.get(`${base}/health`, { preHandler: [...operatorAuth, requireHealthRead] }, async (request, reply) => {
    const result = await useCases.getHealth.execute({ actorId: requireUserId(request) });
    const status = result.status === 'unavailable' ? 503 : 200;
    return reply.status(status).send(result);
  });

  app.get(`${base}/audit-logs`, { preHandler: [...operatorAuth, requireAuditView] }, async (request, reply) => {
    const query = parseBody(auditLogQuerySchema, request.query);
    const result = await useCases.listAuditLogs.execute({
      actorId: requireUserId(request),
      page: { page: query.page, pageSize: query.pageSize },
      action: query.action,
      outcome: query.outcome,
      resourceType: query.resourceType,
      organizationId: query.organizationId,
      actorFilterId: query.actorId,
    });
    return reply.status(200).send(result);
  });
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
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
