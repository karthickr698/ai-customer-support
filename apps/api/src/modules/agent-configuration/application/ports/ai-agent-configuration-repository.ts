import type { AiAgentConfiguration } from '../../domain/ai-agent-configuration.js';
import type { AiAgentConfigurationId } from '../../domain/ai-agent-configuration-id.js';

export interface AiAgentConfigurationRepository {
  findByTenant(tenantId: string): Promise<AiAgentConfiguration | null>;
  findById(id: AiAgentConfigurationId): Promise<AiAgentConfiguration | null>;
  save(configuration: AiAgentConfiguration): Promise<void>;
}
