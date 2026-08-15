import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import {
  createRequirePlatformPermissionPreHandler,
  createResolvePlatformOperatorPreHandler,
  PlatformPermissions,
  type LoadPlatformActorService,
} from '../../../../platform/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  AcknowledgeObservabilityIncidentUseCase,
  ResolveObservabilityIncidentUseCase,
} from '../../../application/use-cases/incident-use-cases.js';
import type {
  GetAiEvaluationUseCase,
  GetObservabilityIncidentUseCase,
  GetObservabilityMetricsUseCase,
  GetObservabilityOverviewUseCase,
  GetObservabilityTraceUseCase,
  ListAiEvaluationsUseCase,
  ListObservabilityIncidentsUseCase,
  ListObservabilityLogsUseCase,
  ListObservabilityTracesUseCase,
} from '../../../application/use-cases/query-observability-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { parseBody } from './parse-body.js';
import {
  evaluationQuerySchema,
  incidentQuerySchema,
  logQuerySchema,
  metricsQuerySchema,
  overviewQuerySchema,
  tenantEvaluationQuerySchema,
  tenantIncidentQuerySchema,
  tenantLogQuerySchema,
  tenantMetricsQuerySchema,
  tenantPeriodQuerySchema,
  tenantTraceQuerySchema,
  traceQuerySchema,
} from './observability-schemas.js';

export type ObservabilityHttpUseCases = {
  readonly overview: GetObservabilityOverviewUseCase;
  readonly listLogs: ListObservabilityLogsUseCase;
  readonly listTraces: ListObservabilityTracesUseCase;
  readonly getTrace: GetObservabilityTraceUseCase;
  readonly metrics: GetObservabilityMetricsUseCase;
  readonly listIncidents: ListObservabilityIncidentsUseCase;
  readonly getIncident: GetObservabilityIncidentUseCase;
  readonly acknowledgeIncident: AcknowledgeObservabilityIncidentUseCase;
  readonly resolveIncident: ResolveObservabilityIncidentUseCase;
  readonly listEvaluations: ListAiEvaluationsUseCase;
  readonly getEvaluation: GetAiEvaluationUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerObservabilityRoutes(
  app: FastifyInstance,
  useCases: ObservabilityHttpUseCases,
  authenticate: AuthenticatePreHandler,
  actors: LoadPlatformActorService,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveOperator = createResolvePlatformOperatorPreHandler(actors);
  const requireRead = createRequirePlatformPermissionPreHandler(PlatformPermissions.OBSERVABILITY_READ);
  const requireManage = createRequirePlatformPermissionPreHandler(PlatformPermissions.OBSERVABILITY_MANAGE);
  const operatorAuth = [authenticate, resolveOperator];
  const platform = '/api/observability';

  app.get(`${platform}/overview`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(overviewQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.overview.execute({
        actorId: requireUserId(request),
        platform: true,
        organizationId: query.organizationId,
        from: query.from,
        to: query.to,
      }),
    );
  });

  app.get(`${platform}/logs`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(logQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listLogs.execute({
        actorId: requireUserId(request),
        platform: true,
        ...query,
      }),
    );
  });

  app.get(`${platform}/traces`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(traceQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listTraces.execute({
        actorId: requireUserId(request),
        platform: true,
        ...query,
      }),
    );
  });

  app.get(`${platform}/traces/:traceId`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(overviewQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.getTrace.execute({
        actorId: requireUserId(request),
        platform: true,
        organizationId: query.organizationId,
        traceId: routeParam(request, 'traceId'),
      }),
    );
  });

  app.get(`${platform}/metrics`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(metricsQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.metrics.execute({
        actorId: requireUserId(request),
        platform: true,
        organizationId: query.organizationId,
        names: query.names,
        from: query.from,
        to: query.to,
      }),
    );
  });

  app.get(`${platform}/failures`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(incidentQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listIncidents.execute({
        actorId: requireUserId(request),
        platform: true,
        ...query,
      }),
    );
  });

  app.get(
    `${platform}/failures/:incidentId`,
    { preHandler: [...operatorAuth, requireRead] },
    async (request, reply) => {
      return reply.status(200).send(
        await useCases.getIncident.execute({
          actorId: requireUserId(request),
          platform: true,
          incidentId: routeParam(request, 'incidentId'),
        }),
      );
    },
  );

  app.post(
    `${platform}/failures/:incidentId/acknowledge`,
    { preHandler: [...operatorAuth, requireManage] },
    async (request, reply) => {
      return reply.status(200).send(
        await useCases.acknowledgeIncident.execute({
          actorId: requireUserId(request),
          platform: true,
          incidentId: routeParam(request, 'incidentId'),
          security: securityContext(request),
        }),
      );
    },
  );

  app.post(
    `${platform}/failures/:incidentId/resolve`,
    { preHandler: [...operatorAuth, requireManage] },
    async (request, reply) => {
      return reply.status(200).send(
        await useCases.resolveIncident.execute({
          actorId: requireUserId(request),
          platform: true,
          incidentId: routeParam(request, 'incidentId'),
          security: securityContext(request),
        }),
      );
    },
  );

  app.get(`${platform}/ai-evaluations`, { preHandler: [...operatorAuth, requireRead] }, async (request, reply) => {
    const query = parseBody(evaluationQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listEvaluations.execute({
        actorId: requireUserId(request),
        platform: true,
        ...query,
      }),
    );
  });

  app.get(
    `${platform}/ai-evaluations/:evaluationId`,
    { preHandler: [...operatorAuth, requireRead] },
    async (request, reply) => {
      return reply.status(200).send(
        await useCases.getEvaluation.execute({
          actorId: requireUserId(request),
          platform: true,
          evaluationId: routeParam(request, 'evaluationId'),
        }),
      );
    },
  );

  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireView = createRequirePermissionPreHandler(Permissions.OBSERVABILITY_VIEW);
  const requireTenantManage = createRequirePermissionPreHandler(Permissions.OBSERVABILITY_MANAGE);
  const tenantAuth = [authenticate, resolveTenant, requireView];
  const tenantManage = [authenticate, resolveTenant, requireTenantManage];
  const org = '/api/organizations/:organizationId/observability';

  app.get(`${org}/overview`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(tenantPeriodQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.overview.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        from: query.from,
        to: query.to,
      }),
    );
  });

  app.get(`${org}/logs`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(tenantLogQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listLogs.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        ...query,
      }),
    );
  });

  app.get(`${org}/traces`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(tenantTraceQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listTraces.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        ...query,
      }),
    );
  });

  app.get(`${org}/traces/:traceId`, { preHandler: tenantAuth }, async (request, reply) => {
    return reply.status(200).send(
      await useCases.getTrace.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        traceId: routeParam(request, 'traceId'),
      }),
    );
  });

  app.get(`${org}/metrics`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(tenantMetricsQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.metrics.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        names: query.names,
        from: query.from,
        to: query.to,
      }),
    );
  });

  app.get(`${org}/failures`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(tenantIncidentQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listIncidents.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        ...query,
      }),
    );
  });

  app.get(`${org}/failures/:incidentId`, { preHandler: tenantAuth }, async (request, reply) => {
    return reply.status(200).send(
      await useCases.getIncident.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        incidentId: routeParam(request, 'incidentId'),
      }),
    );
  });

  app.post(`${org}/failures/:incidentId/acknowledge`, { preHandler: tenantManage }, async (request, reply) => {
    return reply.status(200).send(
      await useCases.acknowledgeIncident.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        incidentId: routeParam(request, 'incidentId'),
        security: securityContext(request),
      }),
    );
  });

  app.post(`${org}/failures/:incidentId/resolve`, { preHandler: tenantManage }, async (request, reply) => {
    return reply.status(200).send(
      await useCases.resolveIncident.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        incidentId: routeParam(request, 'incidentId'),
        security: securityContext(request),
      }),
    );
  });

  app.get(`${org}/ai-evaluations`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(tenantEvaluationQuerySchema, request.query);
    return reply.status(200).send(
      await useCases.listEvaluations.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        ...query,
      }),
    );
  });

  app.get(`${org}/ai-evaluations/:evaluationId`, { preHandler: tenantAuth }, async (request, reply) => {
    return reply.status(200).send(
      await useCases.getEvaluation.execute({
        actorId: requireUserId(request),
        organizationId: requireTenantId(request),
        evaluationId: routeParam(request, 'evaluationId'),
      }),
    );
  });
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
}

function requireTenantId(request: FastifyRequest): string {
  if (!request.tenantAccess) {
    throw new UnauthorizedError();
  }
  return request.tenantAccess.tenantId;
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
