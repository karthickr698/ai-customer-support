import type { AgentSettingsDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AgentSettingsGeneratedEvent } from '../../domain/events.js';
import { InvalidOnboardingStateError } from '../../domain/errors.js';
import { OnboardingPolicy } from '../../domain/onboarding-policy.js';
import { toOnboardingDto, type RequestSecurityContext } from '../dtos.js';
import type { KnowledgeSourceDirectoryPort } from '../ports/knowledge-source-ports.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OnboardingRepository } from '../ports/onboarding-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import { aiContext, loadOrCreateOnboarding } from './get-onboarding-use-case.js';

export class GenerateInitialAgentSettingsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly onboardings: OnboardingRepository,
    private readonly knowledgeSources: KnowledgeSourceDirectoryPort,
    private readonly aiService: AIServicePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    OnboardingPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);

    const now = this.clock.now();
    const setup = await loadOrCreateOnboarding(this.onboardings, actor.tenantId, actor.actorId, now);
    const profile = setup.requireBusinessProfile();
    const selectedToneId = setup.selectedToneId;
    if (!selectedToneId) {
      throw new InvalidOnboardingStateError('Generate support-tone presets before agent settings');
    }

    const sources = await this.knowledgeSources.listByTenant(actor.tenantId);
    const settings = await this.aiService.generateInitialAgentSettings(
      aiContext(actor.tenantId, input.security),
      {
        businessProfile: profile,
        selectedToneId,
        knowledgeSources: sources.map((source) => ({
          type: source.type,
          name: source.name,
          url: source.url ?? undefined,
          description: source.description ?? undefined,
        })),
      },
    );
    setup.applyAgentSettings(settings, now);
    await this.onboardings.save(setup);
    await this.eventBus.publish(
      new AgentSettingsGeneratedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    return {
      agentSettings: setup.agentSettings,
      onboarding: toOnboardingDto(setup, sources),
    };
  }
}

export class UpdateAgentSettingsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly onboardings: OnboardingRepository,
    private readonly knowledgeSources: KnowledgeSourceDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly patch: Partial<AgentSettingsDto>;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    OnboardingPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);
    const setup = await loadOrCreateOnboarding(
      this.onboardings,
      actor.tenantId,
      actor.actorId,
      this.clock.now(),
    );
    const settings = setup.patchAgentSettings(input.patch, this.clock.now());
    await this.onboardings.save(setup);
    const sources = await this.knowledgeSources.listByTenant(actor.tenantId);
    return { agentSettings: settings, onboarding: toOnboardingDto(setup, sources) };
  }
}
