import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerAiAgentConfigurationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/ai-agent-configuration-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresAiAgentConfigurationRepository } from './adapters/outbound/persistence/postgres-ai-agent-configuration-repository.js';
import { AiAgentConfigurationQuery } from './application/ai-agent-configuration-query.js';
import {
  GetAiAgentConfigurationUseCase,
  UpdateAiAgentConfigurationUseCase,
} from './application/use-cases/manage-ai-agent-configuration-use-cases.js';

export type AgentConfigurationModule = {
  readonly configurationQuery: AiAgentConfigurationQuery;
  register(app: FastifyInstance): Promise<void>;
};

export function composeAgentConfiguration(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
}): AgentConfigurationModule {
  const configurations = new PostgresAiAgentConfigurationRepository(input.prisma);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const useCases = {
    getConfiguration: new GetAiAgentConfigurationUseCase(tenantAccess, configurations, clock),
    updateConfiguration: new UpdateAiAgentConfigurationUseCase(
      tenantAccess,
      configurations,
      clock,
      input.eventBus,
    ),
  };

  return {
    configurationQuery: new AiAgentConfigurationQuery(configurations),
    async register(app: FastifyInstance): Promise<void> {
      await registerAiAgentConfigurationRoutes(
        app,
        useCases,
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
