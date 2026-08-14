import type { EventBus } from '@ai-customer-support/shared';
import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { BusinessProfileGeneratedEvent } from '../../domain/events.js';
import { OnboardingPolicy } from '../../domain/onboarding-policy.js';
import { toOnboardingDto, type RequestSecurityContext } from '../dtos.js';
import type { KnowledgeSourceDirectoryPort } from '../ports/knowledge-source-ports.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OnboardingRepository } from '../ports/onboarding-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import { aiContext, loadOrCreateOnboarding } from './get-onboarding-use-case.js';

export class GenerateBusinessProfileUseCase {
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
    readonly description: string;
    readonly companyName?: string;
    readonly websiteUrl?: string;
    readonly industry?: string;
    readonly extraNotes?: string;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    OnboardingPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);

    const now = this.clock.now();
    const setup = await loadOrCreateOnboarding(this.onboardings, actor.tenantId, actor.actorId, now);
    const profile = await this.aiService.generateBusinessProfile(aiContext(actor.tenantId, input.security), {
      description: input.description,
      companyName: input.companyName,
      websiteUrl: input.websiteUrl,
      industry: input.industry,
      extraNotes: input.extraNotes,
    });
    setup.applyBusinessProfile(profile, now);
    await this.onboardings.save(setup);
    await this.eventBus.publish(
      new BusinessProfileGeneratedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    const sources = await this.knowledgeSources.listByTenant(actor.tenantId);
    return {
      businessProfile: profile,
      onboarding: toOnboardingDto(setup, sources),
    };
  }
}
