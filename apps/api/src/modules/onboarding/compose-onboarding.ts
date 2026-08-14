import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { AIServicePort } from '../ai/application/ports/ai-service-port.js';
import type { KnowledgeSourceQuery } from '../knowledge/application/knowledge-source-query.js';
import type { RegisterKnowledgeSourceUseCase } from '../knowledge/application/use-cases/register-knowledge-source-use-case.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerOnboardingRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/onboarding-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import {
  KnowledgeSourceDirectoryAdapter,
  KnowledgeSourceRegistrationAdapter,
} from './adapters/outbound/knowledge/knowledge-source-adapters.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresOnboardingRepository } from './adapters/outbound/persistence/postgres-onboarding-repository.js';
import { GenerateBusinessProfileUseCase } from './application/use-cases/generate-business-profile-use-case.js';
import {
  GenerateInitialAgentSettingsUseCase,
  UpdateAgentSettingsUseCase,
} from './application/use-cases/generate-initial-agent-settings-use-case.js';
import {
  GenerateSupportTonePresetsUseCase,
  SelectSupportToneUseCase,
} from './application/use-cases/generate-support-tone-presets-use-case.js';
import { GetOnboardingUseCase } from './application/use-cases/get-onboarding-use-case.js';
import { AgentSettingsQuery } from './application/agent-settings-query.js';
import { RunOnboardingSetupUseCase } from './application/use-cases/run-onboarding-setup-use-case.js';

export type OnboardingModule = {
  readonly agentSettingsQuery: AgentSettingsQuery;
  register(app: FastifyInstance): Promise<void>;
};

export function composeOnboarding(input: {
  readonly prisma: PrismaClient;
  readonly eventBus: EventBus;
  readonly aiService: AIServicePort;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly knowledgeSourceQuery: KnowledgeSourceQuery;
  readonly registerKnowledgeSource: RegisterKnowledgeSourceUseCase;
}): OnboardingModule {
  const onboardings = new PostgresOnboardingRepository(input.prisma);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const knowledgeSources = new KnowledgeSourceDirectoryAdapter(input.knowledgeSourceQuery);
  const registerSource = new KnowledgeSourceRegistrationAdapter(input.registerKnowledgeSource);

  const getOnboarding = new GetOnboardingUseCase(tenantAccess, onboardings, knowledgeSources, clock);
  const generateBusinessProfile = new GenerateBusinessProfileUseCase(
    tenantAccess,
    onboardings,
    knowledgeSources,
    input.aiService,
    clock,
    input.eventBus,
  );
  const generateSupportTonePresets = new GenerateSupportTonePresetsUseCase(
    tenantAccess,
    onboardings,
    knowledgeSources,
    input.aiService,
    clock,
    input.eventBus,
  );
  const selectSupportTone = new SelectSupportToneUseCase(
    tenantAccess,
    onboardings,
    knowledgeSources,
    clock,
  );
  const generateInitialAgentSettings = new GenerateInitialAgentSettingsUseCase(
    tenantAccess,
    onboardings,
    knowledgeSources,
    input.aiService,
    clock,
    input.eventBus,
  );
  const updateAgentSettings = new UpdateAgentSettingsUseCase(
    tenantAccess,
    onboardings,
    knowledgeSources,
    clock,
  );
  const runOnboardingSetup = new RunOnboardingSetupUseCase(
    tenantAccess,
    onboardings,
    knowledgeSources,
    registerSource,
    input.aiService,
    clock,
    input.eventBus,
  );

  return {
    agentSettingsQuery: new AgentSettingsQuery(onboardings),
    async register(app: FastifyInstance): Promise<void> {
      await registerOnboardingRoutes(
        app,
        {
          getOnboarding,
          runOnboardingSetup,
          generateBusinessProfile,
          generateSupportTonePresets,
          selectSupportTone,
          generateInitialAgentSettings,
          updateAgentSettings,
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
