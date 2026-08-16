import type { AiAgentRuntimeConfigDto } from '@ai-customer-support/contracts';

export interface AgentConfigurationQueryPort {
  findByTenant(tenantId: string): Promise<AiAgentRuntimeConfigDto | null>;
}
