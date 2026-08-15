import type { EventBus, Logger } from '@ai-customer-support/shared';
import { AUTOMATION_SOURCE_EVENTS } from '@ai-customer-support/contracts';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { QueuePort } from '../../shared/application/ports/queue-port.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerAutomationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/automation-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { FetchAutomationHttpAdapter } from './adapters/outbound/http/fetch-automation-http-adapter.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import {
  PostgresAutomationExecutionLogRepository,
  PostgresAutomationJobRepository,
  PostgresAutomationRuleRepository,
} from './adapters/outbound/persistence/postgres-automation-repositories.js';
import { AUTOMATION_EXECUTE_QUEUE, type AutomationExecuteJob } from './application/queues.js';
import { DispatchDueAutomationJobsUseCase } from './application/use-cases/dispatch-due-automation-jobs-use-case.js';
import { EnqueueScheduledAutomationsUseCase } from './application/use-cases/enqueue-scheduled-automations-use-case.js';
import { ExecuteAutomationJobUseCase } from './application/use-cases/execute-automation-job-use-case.js';
import {
  DispatchAutomationsUseCase,
  GetAutomationJobUseCase,
  ListAutomationJobsUseCase,
  ListAutomationLogsUseCase,
  RetryAutomationJobUseCase,
  RunAutomationUseCase,
} from './application/use-cases/job-use-cases.js';
import { MatchAutomationRulesUseCase } from './application/use-cases/match-automation-rules-use-case.js';
import {
  CreateAutomationRuleUseCase,
  DeleteAutomationRuleUseCase,
  GetAutomationRuleUseCase,
  ListAutomationRulesUseCase,
  SetAutomationRuleEnabledUseCase,
  UpdateAutomationRuleUseCase,
} from './application/use-cases/rule-use-cases.js';
import { DISPATCH_INTERVAL_MS } from './domain/automation-policy.js';

export type AutomationsModule = {
  register(app: FastifyInstance): Promise<void>;
  start(): void;
  stop(): void;
};

export function composeAutomations(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly queue: QueuePort;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly allowLocalHttp: boolean;
}): AutomationsModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const rules = new PostgresAutomationRuleRepository(input.prisma);
  const jobs = new PostgresAutomationJobRepository(input.prisma);
  const logs = new PostgresAutomationExecutionLogRepository(input.prisma);
  const http = new FetchAutomationHttpAdapter();
  const matchRules = new MatchAutomationRulesUseCase(
    rules,
    jobs,
    input.queue,
    clock,
    input.eventBus,
    input.logger,
  );
  const enqueueScheduled = new EnqueueScheduledAutomationsUseCase(
    rules,
    jobs,
    input.queue,
    clock,
    input.eventBus,
    input.logger,
  );
  const dispatchDue = new DispatchDueAutomationJobsUseCase(jobs, input.queue, clock, input.logger);
  const executeJob = new ExecuteAutomationJobUseCase(
    rules,
    jobs,
    logs,
    http,
    clock,
    input.eventBus,
    input.logger,
  );

  input.queue.process<AutomationExecuteJob>(AUTOMATION_EXECUTE_QUEUE, (message) => executeJob.execute(message));
  for (const eventName of AUTOMATION_SOURCE_EVENTS) {
    input.eventBus.subscribe(eventName, (event) => matchRules.handle(event));
  }

  let timer: NodeJS.Timeout | undefined;

  return {
    async register(app: FastifyInstance): Promise<void> {
      await registerAutomationRoutes(
        app,
        {
          createRule: new CreateAutomationRuleUseCase(
            tenantAccess,
            rules,
            clock,
            input.eventBus,
            input.allowLocalHttp,
          ),
          listRules: new ListAutomationRulesUseCase(tenantAccess, rules),
          getRule: new GetAutomationRuleUseCase(tenantAccess, rules),
          updateRule: new UpdateAutomationRuleUseCase(
            tenantAccess,
            rules,
            clock,
            input.eventBus,
            input.allowLocalHttp,
          ),
          deleteRule: new DeleteAutomationRuleUseCase(tenantAccess, rules, clock, input.eventBus),
          setEnabled: new SetAutomationRuleEnabledUseCase(tenantAccess, rules, clock, input.eventBus),
          runRule: new RunAutomationUseCase(
            tenantAccess,
            rules,
            jobs,
            input.queue,
            clock,
            input.eventBus,
          ),
          listJobs: new ListAutomationJobsUseCase(tenantAccess, jobs),
          getJob: new GetAutomationJobUseCase(tenantAccess, jobs),
          retryJob: new RetryAutomationJobUseCase(tenantAccess, jobs, input.queue, clock),
          listLogs: new ListAutomationLogsUseCase(tenantAccess, logs),
          dispatch: new DispatchAutomationsUseCase(tenantAccess, enqueueScheduled, dispatchDue),
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
    start(): void {
      timer = setInterval(() => {
        void (async () => {
          await enqueueScheduled.execute().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Scheduled automation enqueue failed';
            input.logger.warn('Scheduled automation enqueue failed', { message });
          });
          await dispatchDue.execute().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Automation dispatch failed';
            input.logger.warn('Automation dispatch failed', { message });
          });
        })();
      }, DISPATCH_INTERVAL_MS);
      timer.unref();
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}
