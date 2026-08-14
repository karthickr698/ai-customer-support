import { isSupportToneId, type KnowledgeSourceBriefDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  AgentSettingsGeneratedEvent,
  BusinessProfileGeneratedEvent,
  OnboardingCompletedEvent,
  SupportTonesGeneratedEvent,
} from '../../domain/events.js';
import { OnboardingPolicy } from '../../domain/onboarding-policy.js';
import { toOnboardingDto, type RequestSecurityContext } from '../dtos.js';
import type {
  KnowledgeSourceDirectoryPort,
  KnowledgeSourceRegistrationPort,
} from '../ports/knowledge-source-ports.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OnboardingRepository } from '../ports/onboarding-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import { aiContext, loadOrCreateOnboarding } from './get-onboarding-use-case.js';

export class RunOnboardingSetupUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly onboardings: OnboardingRepository,
    private readonly knowledgeSources: KnowledgeSourceDirectoryPort,
    private readonly registerSource: KnowledgeSourceRegistrationPort,
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
    readonly selectedToneId?: string;
    readonly knowledgeSources?: readonly KnowledgeSourceBriefDto[];
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    OnboardingPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);

    const now = this.clock.now();
    const setup = await loadOrCreateOnboarding(this.onboardings, actor.tenantId, actor.actorId, now);
    const existingSources = await this.knowledgeSources.listByTenant(actor.tenantId);
    const incoming = input.knowledgeSources ?? [];

    const draft = await this.aiService.runOnboardingSetup(aiContext(actor.tenantId, input.security), {
      description: input.description,
      companyName: input.companyName,
      websiteUrl: input.websiteUrl,
      industry: input.industry,
      extraNotes: input.extraNotes,
      selectedToneId: isSupportToneId(input.selectedToneId) ? input.selectedToneId : undefined,
      knowledgeSources: incoming,
    });

    setup.applyBusinessProfile(draft.businessProfile, now);
    setup.applyTonePresets(draft.tonePresets, draft.selectedToneId, now);
    setup.applyAgentSettings(draft.agentSettings, now);
    await this.onboardings.save(setup);

    for (const source of incoming) {
      await this.registerSource.register({
        tenantId: actor.tenantId,
        actorId: actor.actorId,
        source,
        requestId: input.security.requestId,
        correlationId: input.security.correlationId,
        ipAddress: input.security.ipAddress,
        userAgent: input.security.userAgent,
      });
    }

    const sources =
      incoming.length > 0
        ? await this.knowledgeSources.listByTenant(actor.tenantId)
        : existingSources;

    await this.eventBus.publish(
      new BusinessProfileGeneratedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    await this.eventBus.publish(
      new SupportTonesGeneratedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        draft.selectedToneId,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    await this.eventBus.publish(
      new AgentSettingsGeneratedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    if (setup.status === 'completed') {
      await this.eventBus.publish(
        new OnboardingCompletedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          actor.actorId,
          input.security.correlationId,
        ),
      );
    }

    return { onboarding: toOnboardingDto(setup, sources) };
  }
}
