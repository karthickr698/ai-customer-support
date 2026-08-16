import type { AiAgentRuntimeConfigDto } from '@ai-customer-support/contracts';
import { toAiAgentRuntimeConfigDto } from './dtos.js';
import type { AiAgentConfigurationRepository } from './ports/ai-agent-configuration-repository.js';

export class AiAgentConfigurationQuery {
  constructor(private readonly configurations: AiAgentConfigurationRepository) {}

  async findByTenant(tenantId: string): Promise<AiAgentRuntimeConfigDto | null> {
    const configuration = await this.configurations.findByTenant(tenantId);
    return configuration ? toAiAgentRuntimeConfigDto(configuration) : null;
  }
}
