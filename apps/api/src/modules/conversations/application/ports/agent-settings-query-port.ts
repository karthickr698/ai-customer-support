import type { AgentSettingsDto } from '@ai-customer-support/contracts';

export interface AgentSettingsQueryPort {
  findByTenant(tenantId: string): Promise<AgentSettingsDto | null>;
}
