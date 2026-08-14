import type { AgentSettingsDto } from '@ai-customer-support/contracts';
import type { OnboardingRepository } from './ports/onboarding-repository.js';

export class AgentSettingsQuery {
  constructor(private readonly onboardings: OnboardingRepository) {}

  async findByTenant(tenantId: string): Promise<AgentSettingsDto | null> {
    const setup = await this.onboardings.findByTenant(tenantId);
    return setup?.agentSettings ?? null;
  }
}
