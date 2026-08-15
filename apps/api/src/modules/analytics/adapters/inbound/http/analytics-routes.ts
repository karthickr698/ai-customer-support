import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  createResolveTenantPreHandler,
  Permissions,
  type ResolveTenantAccessUseCase,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type { ExportAnalyticsReportUseCase } from '../../../application/use-cases/export-analytics-report-use-case.js';
import type { GetAnalyticsOverviewUseCase } from '../../../application/use-cases/get-analytics-overview-use-case.js';
import type { GetAnalyticsTimeSeriesUseCase } from '../../../application/use-cases/get-analytics-time-series-use-case.js';
import type {
  GetAgentAnalyticsUseCase,
  GetConversationAnalyticsUseCase,
  GetCustomerAnalyticsUseCase,
  GetTicketAnalyticsUseCase,
} from '../../../application/use-cases/report-use-cases.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import {
  analyticsExportQuerySchema,
  analyticsPeriodQuerySchema,
  analyticsReportParamSchema,
  analyticsTimeSeriesQuerySchema,
} from './analytics-schemas.js';
import { parseBody } from './parse-body.js';

export type AnalyticsHttpUseCases = {
  readonly overview: GetAnalyticsOverviewUseCase;
  readonly timeseries: GetAnalyticsTimeSeriesUseCase;
  readonly conversations: GetConversationAnalyticsUseCase;
  readonly tickets: GetTicketAnalyticsUseCase;
  readonly agents: GetAgentAnalyticsUseCase;
  readonly customers: GetCustomerAnalyticsUseCase;
  readonly exportReport: ExportAnalyticsReportUseCase;
};

export type AuthenticatePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  useCases: AnalyticsHttpUseCases,
  authenticate: AuthenticatePreHandler,
  resolveTenantAccess: ResolveTenantAccessUseCase,
): Promise<void> {
  const resolveTenant = createResolveTenantPreHandler(resolveTenantAccess);
  const requireView = createRequirePermissionPreHandler(Permissions.ANALYTICS_VIEW);
  const tenantAuth = [authenticate, resolveTenant, requireView];
  const org = '/api/organizations/:organizationId/analytics';

  app.get(`${org}/overview`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(analyticsPeriodQuerySchema, request.query);
    const result = await useCases.overview.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...query,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/timeseries`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(analyticsTimeSeriesQuerySchema, request.query);
    const result = await useCases.timeseries.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...query,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/conversations`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(analyticsPeriodQuerySchema, request.query);
    const result = await useCases.conversations.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...query,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/tickets`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(analyticsPeriodQuerySchema, request.query);
    const result = await useCases.tickets.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...query,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/agents`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(analyticsPeriodQuerySchema, request.query);
    const result = await useCases.agents.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...query,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/customers`, { preHandler: tenantAuth }, async (request, reply) => {
    const query = parseBody(analyticsPeriodQuerySchema, request.query);
    const result = await useCases.customers.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      ...query,
    });
    return reply.status(200).send(result);
  });

  app.get(`${org}/exports/:report`, { preHandler: tenantAuth }, async (request, reply) => {
    const params = parseBody(analyticsReportParamSchema, request.params);
    const query = parseBody(analyticsExportQuerySchema, request.query);
    const result = await useCases.exportReport.execute({
      tenantId: requireTenantId(request),
      actorId: requireUserId(request),
      report: params.report,
      ...query,
      security: securityContext(request),
    });
    return reply
      .type(result.contentType)
      .header('content-disposition', `attachment; filename="${result.filename}"`)
      .status(200)
      .send(result.body);
  });
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
