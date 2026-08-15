import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { AICallTelemetry, AICallTelemetryPort } from '../ai/application/ports/ai-service-port.js';
import type { LoadPlatformActorService } from '../platform/application/use-cases/operator-use-cases.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerObservabilityRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/observability-routes.js';
import { registerObservabilityHooks } from './adapters/inbound/http/register-observability-hooks.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PlatformOperatorAccessAdapter } from './adapters/outbound/platform/platform-operator-access-adapter.js';
import {
  PostgresObservabilityAiEvaluationRepository,
  PostgresObservabilityIncidentRepository,
  PostgresObservabilityLogRepository,
  PostgresObservabilityMetricRepository,
  PostgresObservabilityTraceRepository,
} from './adapters/outbound/persistence/postgres-observability-repositories.js';
import { RedisErrorRateWindow } from './adapters/outbound/redis/redis-error-rate-window.js';
import {
  AcknowledgeObservabilityIncidentUseCase,
  ResolveObservabilityIncidentUseCase,
} from './application/use-cases/incident-use-cases.js';
import {
  GetAiEvaluationUseCase,
  GetObservabilityIncidentUseCase,
  GetObservabilityMetricsUseCase,
  GetObservabilityOverviewUseCase,
  GetObservabilityTraceUseCase,
  ListAiEvaluationsUseCase,
  ListObservabilityIncidentsUseCase,
  ListObservabilityLogsUseCase,
  ListObservabilityTracesUseCase,
} from './application/use-cases/query-observability-use-cases.js';
import { RecordAiTelemetryUseCase } from './application/use-cases/record-ai-telemetry-use-case.js';
import { RecordHttpObservabilityUseCase } from './application/use-cases/record-http-observability-use-case.js';

export type ObservabilityModule = {
  register(app: FastifyInstance): Promise<void>;
  readonly telemetry: AICallTelemetryPort;
};

export function composeObservability(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly logger: Logger;
  readonly config: AppConfig;
  readonly authenticate: AuthenticatePreHandler;
  readonly platformActors: LoadPlatformActorService;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
}): ObservabilityModule {
  const clock = new SystemClock();
  const platformAccess = new PlatformOperatorAccessAdapter(input.platformActors);
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const logs = new PostgresObservabilityLogRepository(input.prisma);
  const traces = new PostgresObservabilityTraceRepository(input.prisma);
  const metrics = new PostgresObservabilityMetricRepository(input.prisma);
  const incidents = new PostgresObservabilityIncidentRepository(input.prisma);
  const evaluations = new PostgresObservabilityAiEvaluationRepository(input.prisma);
  const errorRates = new RedisErrorRateWindow(input.redis);
  const recordHttp = new RecordHttpObservabilityUseCase(
    logs,
    traces,
    metrics,
    incidents,
    errorRates,
    clock,
    input.eventBus,
    input.config.OBSERVABILITY_ERROR_WINDOW_SECONDS,
    input.config.OBSERVABILITY_ERROR_RATE_THRESHOLD,
    input.config.OBSERVABILITY_MIN_SAMPLE_SIZE,
  );
  const recordAi = new RecordAiTelemetryUseCase(
    logs,
    traces,
    metrics,
    evaluations,
    incidents,
    errorRates,
    clock,
    input.eventBus,
    input.config.OBSERVABILITY_ERROR_WINDOW_SECONDS,
    input.config.OBSERVABILITY_AI_FAILURE_THRESHOLD,
  );
  const overview = new GetObservabilityOverviewUseCase(
    platformAccess,
    tenantAccess,
    metrics,
    traces,
    incidents,
    clock,
  );
  const listLogs = new ListObservabilityLogsUseCase(platformAccess, tenantAccess, logs, clock);
  const listTraces = new ListObservabilityTracesUseCase(platformAccess, tenantAccess, traces, clock);
  const getTrace = new GetObservabilityTraceUseCase(platformAccess, tenantAccess, traces);
  const getMetrics = new GetObservabilityMetricsUseCase(platformAccess, tenantAccess, metrics, clock);
  const listIncidents = new ListObservabilityIncidentsUseCase(platformAccess, tenantAccess, incidents, clock);
  const getIncident = new GetObservabilityIncidentUseCase(platformAccess, tenantAccess, incidents);
  const acknowledgeIncident = new AcknowledgeObservabilityIncidentUseCase(
    platformAccess,
    tenantAccess,
    incidents,
    clock,
    input.eventBus,
  );
  const resolveIncident = new ResolveObservabilityIncidentUseCase(
    platformAccess,
    tenantAccess,
    incidents,
    clock,
    input.eventBus,
  );
  const listEvaluations = new ListAiEvaluationsUseCase(platformAccess, tenantAccess, evaluations, clock);
  const getEvaluation = new GetAiEvaluationUseCase(platformAccess, tenantAccess, evaluations);

  return {
    telemetry: {
      async record(telemetry: AICallTelemetry): Promise<void> {
        try {
          await recordAi.execute(telemetry);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'AI telemetry persist failed';
          input.logger.warn('Failed to record AI telemetry', { message });
        }
      },
    },
    async register(app: FastifyInstance): Promise<void> {
      registerObservabilityHooks(app, { recordHttp, logger: input.logger });
      await registerObservabilityRoutes(
        app,
        {
          overview,
          listLogs,
          listTraces,
          getTrace,
          metrics: getMetrics,
          listIncidents,
          getIncident,
          acknowledgeIncident,
          resolveIncident,
          listEvaluations,
          getEvaluation,
        },
        input.authenticate,
        input.platformActors,
        input.resolveTenantAccess,
      );
    },
  };
}
