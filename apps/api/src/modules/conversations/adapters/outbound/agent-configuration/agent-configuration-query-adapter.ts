import type { AiAgentRuntimeConfigDto } from '@ai-customer-support/contracts';
import type { AiAgentConfigurationQuery } from '../../../../agent-configuration/application/ai-agent-configuration-query.js';
import type { AgentConfigurationQueryPort } from '../../../application/ports/agent-configuration-query-port.js';

export class AgentConfigurationQueryAdapter implements AgentConfigurationQueryPort {
  constructor(private readonly query: AiAgentConfigurationQuery) {}

  findByTenant(tenantId: string): Promise<AiAgentRuntimeConfigDto | null> {
    return this.query.findByTenant(tenantId);
  }
}
