import type { AgentSettingsDto } from '@ai-customer-support/contracts';
import type { AgentSettingsQuery } from '../../../../onboarding/application/agent-settings-query.js';
import type { AgentSettingsQueryPort } from '../../../application/ports/agent-settings-query-port.js';

export class OnboardingAgentSettingsAdapter implements AgentSettingsQueryPort {
  constructor(private readonly query: AgentSettingsQuery) {}

  findByTenant(tenantId: string): Promise<AgentSettingsDto | null> {
    return this.query.findByTenant(tenantId);
  }
}
