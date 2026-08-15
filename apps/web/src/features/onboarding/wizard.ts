import type {
  KnowledgeSourceType,
  OnboardingDto,
  OnboardingStatus,
  SupportToneId,
  UpdateAgentSettingsRequest,
} from '@ai-customer-support/contracts';

export const WIZARD_STEPS = ['profile', 'tone', 'knowledge'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const STEP_LABELS: Record<WizardStep, string> = {
  profile: 'Business profile',
  tone: 'Support tone',
  knowledge: 'Knowledge',
};

export type AgentPreviewModel = {
  readonly ready: boolean;
  readonly assistantName: string;
  readonly greeting: string;
  readonly signature: string | null;
  readonly language: string;
  readonly exampleReply: string | null;
  readonly allowedTopics: readonly string[];
  readonly forbiddenTopics: readonly string[];
  readonly escalateWhen: readonly string[];
  readonly collectContactInfo: boolean;
  readonly handoffToHuman: boolean;
  readonly maxAutonomyTurns: number | null;
  readonly toneName: string | null;
  readonly toneId: SupportToneId | null;
  readonly sourceCount: number;
};

export function inferWizardStep(onboarding: OnboardingDto): WizardStep {
  if (!onboarding.businessProfile || onboarding.tonePresets.length === 0) {
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

export function sourceTypeLabel(type: KnowledgeSourceType): string {
  switch (type) {
    case 'help_center':
      return 'Help center';
    case 'sitemap':
      return 'Sitemap';
    case 'url':
      return 'URL';
    case 'text':
      return 'Text';
    case 'file':
      return 'File';
    default:
      return type;
  }
}

export function toAgentPreview(
  onboarding: OnboardingDto,
  draft?: UpdateAgentSettingsRequest | null,
  selectedToneId?: SupportToneId | null,
): AgentPreviewModel {
  const toneId = draft?.selectedToneId ?? selectedToneId ?? onboarding.selectedToneId;
  const tone = onboarding.tonePresets.find((preset) => preset.id === toneId);
  const settings = onboarding.agentSettings;
  const company = onboarding.businessProfile?.companyName;
  const fallbackName = company ? `${company} assistant` : 'Support assistant';
  const fallbackGreeting = company
    ? `Hi — I'm here to help with ${company}. How can I assist you today?`
    : "Hi — I'm here to help. How can I assist you today?";

  return {
    ready: Boolean(onboarding.businessProfile || settings || tone),
    assistantName: pickText(draft?.assistantName, settings?.assistantName, fallbackName),
    greeting: pickText(draft?.greeting, settings?.greeting, fallbackGreeting),
    signature: pickNullable(draft?.signature, settings?.signature ?? null),
    language: pickText(draft?.language, settings?.language, 'English'),
    exampleReply: tone?.exampleReply ?? null,
    allowedTopics: draft?.allowedTopics ?? settings?.allowedTopics ?? onboarding.businessProfile?.commonIntents ?? [],
    forbiddenTopics: draft?.forbiddenTopics ?? settings?.forbiddenTopics ?? [],
    escalateWhen: draft?.escalateWhen ?? settings?.escalateWhen ?? onboarding.businessProfile?.escalationTopics ?? [],
    collectContactInfo: draft?.collectContactInfo ?? settings?.collectContactInfo ?? true,
    handoffToHuman: draft?.handoffToHuman ?? settings?.handoffToHuman ?? true,
    maxAutonomyTurns: draft?.maxAutonomyTurns ?? settings?.maxAutonomyTurns ?? null,
    toneName: tone?.name ?? null,
    toneId: toneId,
    sourceCount: onboarding.knowledgeSources.length,
  };
}

function pickText(draft: string | undefined, saved: string | undefined, fallback: string): string {
  if (draft !== undefined) {
    const trimmed = draft.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (saved && saved.trim().length > 0) {
    return saved;
  }
  return fallback;
}

function pickNullable(
  draft: string | null | undefined,
  saved: string | null,
): string | null {
  if (draft === undefined) {
    return saved && saved.trim().length > 0 ? saved : null;
  }
  if (draft === null) {
    return null;
  }
  const trimmed = draft.trim();
  return trimmed.length > 0 ? trimmed : null;
}
