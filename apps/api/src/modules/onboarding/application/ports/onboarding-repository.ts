import type { OnboardingSetup } from '../../domain/onboarding-setup.js';

export interface OnboardingRepository {
  findByTenant(tenantId: string): Promise<OnboardingSetup | null>;
  save(setup: OnboardingSetup): Promise<void>;
}
