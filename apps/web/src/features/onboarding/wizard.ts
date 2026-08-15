import type { OnboardingDto, OnboardingStatus } from '@ai-customer-support/contracts';

export const WIZARD_STEPS = ['brief', 'profile', 'tone', 'agent', 'knowledge'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const STEP_LABELS: Record<WizardStep, string> = {
  brief: 'Company',
  profile: 'Profile',
  tone: 'Tone',
  agent: 'Agent',
  knowledge: 'Knowledge',
};

export function inferWizardStep(onboarding: OnboardingDto): WizardStep {
  if (!onboarding.businessProfile) {
    return 'brief';
  }
  if (onboarding.tonePresets.length === 0) {
    return 'profile';
  }
  if (!onboarding.agentSettings) {
    return 'tone';
  }
  return 'knowledge';
}

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export function onboardingStatusLabel(status: OnboardingStatus): string {
  switch (status) {
    case 'completed':
      return 'Complete';
    case 'in_progress':
      return 'In progress';
    default:
      return 'Not started';
  }
}
