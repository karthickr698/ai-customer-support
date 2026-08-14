import type { EventBus } from '@ai-customer-support/shared';
import type { SupportToneId } from '@ai-customer-support/contracts';
import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { SupportTonesGeneratedEvent } from '../../domain/events.js';
import { OnboardingPolicy } from '../../domain/onboarding-policy.js';
import { toOnboardingDto, type RequestSecurityContext } from '../dtos.js';
import type { KnowledgeSourceDirectoryPort } from '../ports/knowledge-source-ports.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OnboardingRepository } from '../ports/onboarding-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import { aiContext, loadOrCreateOnboarding } from './get-onboarding-use-case.js';

export class GenerateSupportTonePresetsUseCase {
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
    const generated = await this.aiService.generateSupportTonePresets(
      aiContext(actor.tenantId, input.security),
      { businessProfile: profile },
    );
    setup.applyTonePresets(generated.items, generated.selectedToneId, now);
    await this.onboardings.save(setup);
    await this.eventBus.publish(
      new SupportTonesGeneratedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        generated.selectedToneId,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    const sources = await this.knowledgeSources.listByTenant(actor.tenantId);
    return {
      items: generated.items,
      selectedToneId: generated.selectedToneId,
      onboarding: toOnboardingDto(setup, sources),
    };
  }
}

export class SelectSupportToneUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly onboardings: OnboardingRepository,
    private readonly knowledgeSources: KnowledgeSourceDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly selectedToneId: SupportToneId;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    OnboardingPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);
    const setup = await loadOrCreateOnboarding(
      this.onboardings,
      actor.tenantId,
      actor.actorId,
      this.clock.now(),
    );
    setup.selectTone(input.selectedToneId, this.clock.now());
    await this.onboardings.save(setup);
    const sources = await this.knowledgeSources.listByTenant(actor.tenantId);
    return {
      items: setup.tonePresets,
      selectedToneId: setup.selectedToneId ?? null,
      onboarding: toOnboardingDto(setup, sources),
    };
  }
}
