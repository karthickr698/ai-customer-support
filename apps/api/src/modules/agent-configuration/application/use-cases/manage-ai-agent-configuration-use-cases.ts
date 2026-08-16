import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AiAgentConfiguration } from '../../domain/ai-agent-configuration.js';
import { AiAgentConfigurationUpdatedEvent } from '../../domain/events.js';
import { AiAgentConfigurationPolicy } from '../../domain/ai-agent-configuration-policy.js';
import {
  aiAgentConfigurationCatalog,
  toAiAgentConfigurationDto,
  type RequestSecurityContext,
} from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { AiAgentConfigurationRepository } from '../ports/ai-agent-configuration-repository.js';

export class GetAiAgentConfigurationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly configurations: AiAgentConfigurationRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AiAgentConfigurationPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const configuration = await loadOrCreateConfiguration(
      this.configurations,
      actor.tenantId,
      this.clock.now(),
    );
    return {
      configuration: toAiAgentConfigurationDto(configuration),
      catalog: aiAgentConfigurationCatalog(),
    };
  }
}

export class UpdateAiAgentConfigurationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly configurations: AiAgentConfigurationRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly model?: string;
    readonly qualityModel?: string;
    readonly temperature?: number;
    readonly maxOutputTokens?: number;
    readonly maxInputTokens?: number;
    readonly systemPrompt?: string;
    readonly enabledTools?: readonly string[];
    readonly fallbackMode?: string;
    readonly fallbackReply?: string | null;
    readonly fallbackMaxRetries?: number;
    readonly citationPolicy?: string;
    readonly refuseUnknown?: boolean;
    readonly refuseOffTopic?: boolean;
    readonly languageLock?: boolean;
    readonly redactPii?: boolean;
    readonly security: RequestSecurityContext;
  }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AiAgentConfigurationPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_UPDATE);
    const now = this.clock.now();
    const configuration = await loadOrCreateConfiguration(this.configurations, actor.tenantId, now);
    configuration.update(input, now);
    await this.configurations.save(configuration);
    await this.eventBus.publish(
      new AiAgentConfigurationUpdatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        configuration.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return {
      configuration: toAiAgentConfigurationDto(configuration),
      catalog: aiAgentConfigurationCatalog(),
    };
  }
}

export async function loadOrCreateConfiguration(
  configurations: AiAgentConfigurationRepository,
  tenantId: string,
  now: Date,
): Promise<AiAgentConfiguration> {
  const existing = await configurations.findByTenant(tenantId);
  if (existing) {
    return existing;
  }

  const created = AiAgentConfiguration.createDefault({ organizationId: tenantId, now });
  await configurations.save(created);
  return created;
}
