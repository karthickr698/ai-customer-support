import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerAnalyticsRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/analytics-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresAnalyticsQueryAdapter } from './adapters/outbound/persistence/postgres-analytics-query-adapter.js';
import { ExportAnalyticsReportUseCase } from './application/use-cases/export-analytics-report-use-case.js';
import { GetAnalyticsOverviewUseCase } from './application/use-cases/get-analytics-overview-use-case.js';
import { GetAnalyticsTimeSeriesUseCase } from './application/use-cases/get-analytics-time-series-use-case.js';
import {
  GetAgentAnalyticsUseCase,
  GetConversationAnalyticsUseCase,
  GetCustomerAnalyticsUseCase,
  GetTicketAnalyticsUseCase,
} from './application/use-cases/report-use-cases.js';

export type AnalyticsModule = {
  register(app: FastifyInstance): Promise<void>;
};

export function composeAnalytics(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
}): AnalyticsModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const queries = new PostgresAnalyticsQueryAdapter(input.prisma);
  const overview = new GetAnalyticsOverviewUseCase(tenantAccess, queries, clock);
  const timeseries = new GetAnalyticsTimeSeriesUseCase(tenantAccess, queries, clock);
  const conversations = new GetConversationAnalyticsUseCase(tenantAccess, queries, clock);
  const tickets = new GetTicketAnalyticsUseCase(tenantAccess, queries, clock);
  const agents = new GetAgentAnalyticsUseCase(tenantAccess, queries, clock);
  const customers = new GetCustomerAnalyticsUseCase(tenantAccess, queries, clock);
  const exportReport = new ExportAnalyticsReportUseCase(
    tenantAccess,
    overview,
    timeseries,
    conversations,
    tickets,
    agents,
    customers,
    clock,
    input.eventBus,
  );

  return {
    async register(app: FastifyInstance): Promise<void> {
      await registerAnalyticsRoutes(
        app,
        {
          overview,
          timeseries,
          conversations,
          tickets,
          agents,
          customers,
          exportReport,
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
