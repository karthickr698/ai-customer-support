/**
 * Cross-runtime DTOs for AI onboarding setup.
 * Python generates these shapes; TypeScript validates them again before persistence.
 */

export const SUPPORT_TONE_IDS = [
  'professional',
  'friendly',
  'empathetic',
  'concise',
  'playful',
] as const;
export type SupportToneId = (typeof SUPPORT_TONE_IDS)[number];

export const KNOWLEDGE_SOURCE_TYPES = ['url', 'help_center', 'sitemap', 'text', 'file'] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_SOURCE_STATUSES = ['registered', 'processing', 'ready', 'failed'] as const;
export type KnowledgeSourceStatus = (typeof KNOWLEDGE_SOURCE_STATUSES)[number];

export const ONBOARDING_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const BUSINESS_PROFILE_SCHEMA_VERSION = 1;
export const AGENT_SETTINGS_SCHEMA_VERSION = 1;

export type BusinessProfileDto = {
  readonly schemaVersion: typeof BUSINESS_PROFILE_SCHEMA_VERSION;
  readonly companyName: string;
  readonly industry: string;
  readonly description: string;
  readonly productsAndServices: readonly string[];
  readonly targetAudience: string;
  readonly supportChannels: readonly string[];
  readonly commonIntents: readonly string[];
  readonly escalationTopics: readonly string[];
  readonly brandValues: readonly string[];
  readonly languages: readonly string[];
  readonly hoursOfOperation: string | null;
  readonly websiteUrl: string | null;
};

export type SupportTonePresetDto = {
  readonly id: SupportToneId;
  readonly name: string;
  readonly description: string;
  readonly voiceGuidelines: string;
  readonly exampleReply: string;
  readonly recommended: boolean;
};

export type AgentSettingsDto = {
  readonly schemaVersion: typeof AGENT_SETTINGS_SCHEMA_VERSION;
  readonly assistantName: string;
  readonly greeting: string;
  readonly signature: string | null;
  readonly selectedToneId: SupportToneId;
  readonly systemInstructions: string;
  readonly allowedTopics: readonly string[];
  readonly forbiddenTopics: readonly string[];
  readonly escalateWhen: readonly string[];
  readonly language: string;
  readonly collectContactInfo: boolean;
  readonly handoffToHuman: boolean;
  readonly maxAutonomyTurns: number;
};

export type KnowledgeSourceBriefDto = {
  readonly type: KnowledgeSourceType;
  readonly name: string;
  readonly url?: string;
  readonly description?: string;
};

export type KnowledgeSourceDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly type: KnowledgeSourceType;
  readonly name: string;
  readonly url: string | null;
  readonly description: string | null;
  readonly status: KnowledgeSourceStatus;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type OnboardingBriefDto = {
  readonly companyName?: string;
  readonly description: string;
  readonly websiteUrl?: string;
  readonly industry?: string;
  readonly extraNotes?: string;
};

export type GenerateBusinessProfileRequest = OnboardingBriefDto;

export type GenerateSupportTonePresetsRequest = {
  readonly businessProfile: BusinessProfileDto;
};

export type GenerateInitialAgentSettingsRequest = {
  readonly businessProfile: BusinessProfileDto;
  readonly selectedToneId?: SupportToneId;
  readonly knowledgeSources?: readonly KnowledgeSourceBriefDto[];
};

export type RunOnboardingSetupRequest = OnboardingBriefDto & {
  readonly selectedToneId?: SupportToneId;
  readonly knowledgeSources?: readonly KnowledgeSourceBriefDto[];
};

export type RegisterKnowledgeSourceRequest = KnowledgeSourceBriefDto;

export type SelectSupportToneRequest = {
  readonly selectedToneId: SupportToneId;
};

export type UpdateAgentSettingsRequest = {
  readonly assistantName?: string;
  readonly greeting?: string;
  readonly signature?: string | null;
  readonly selectedToneId?: SupportToneId;
  readonly systemInstructions?: string;
  readonly allowedTopics?: readonly string[];
  readonly forbiddenTopics?: readonly string[];
  readonly escalateWhen?: readonly string[];
  readonly language?: string;
  readonly collectContactInfo?: boolean;
  readonly handoffToHuman?: boolean;
  readonly maxAutonomyTurns?: number;
};

export type BusinessProfileResponse = {
  readonly businessProfile: BusinessProfileDto;
};

export type SupportTonePresetListResponse = {
  readonly items: readonly SupportTonePresetDto[];
  readonly selectedToneId: SupportToneId | null;
};

export type AgentSettingsResponse = {
  readonly agentSettings: AgentSettingsDto;
};

export type KnowledgeSourceResponse = {
  readonly source: KnowledgeSourceDto;
};

export type KnowledgeSourceListResponse = {
  readonly items: readonly KnowledgeSourceDto[];
};

export type OnboardingSetupDraftDto = {
  readonly businessProfile: BusinessProfileDto;
  readonly tonePresets: readonly SupportTonePresetDto[];
  readonly selectedToneId: SupportToneId;
  readonly agentSettings: AgentSettingsDto;
};

export type OnboardingDto = {
  readonly organizationId: string;
  readonly status: OnboardingStatus;
  readonly businessProfile: BusinessProfileDto | null;
  readonly tonePresets: readonly SupportTonePresetDto[];
  readonly selectedToneId: SupportToneId | null;
  readonly agentSettings: AgentSettingsDto | null;
  readonly knowledgeSources: readonly KnowledgeSourceDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type OnboardingResponse = {
  readonly onboarding: OnboardingDto;
};

export function isSupportToneId(value: unknown): value is SupportToneId {
  return typeof value === 'string' && (SUPPORT_TONE_IDS as readonly string[]).includes(value);
}

export function isKnowledgeSourceType(value: unknown): value is KnowledgeSourceType {
  return typeof value === 'string' && (KNOWLEDGE_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isBusinessProfileDto(value: unknown): value is BusinessProfileDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === BUSINESS_PROFILE_SCHEMA_VERSION &&
    isNonEmptyString(value.companyName) &&
    isNonEmptyString(value.industry) &&
    isNonEmptyString(value.description) &&
    isStringArray(value.productsAndServices) &&
    isNonEmptyString(value.targetAudience) &&
    isStringArray(value.supportChannels) &&
    isStringArray(value.commonIntents) &&
    isStringArray(value.escalationTopics) &&
    isStringArray(value.brandValues) &&
    isStringArray(value.languages) &&
    isNullableString(value.hoursOfOperation) &&
    isNullableString(value.websiteUrl)
  );
}

export function isSupportTonePresetDto(value: unknown): value is SupportTonePresetDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isSupportToneId(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.voiceGuidelines) &&
    isNonEmptyString(value.exampleReply) &&
    typeof value.recommended === 'boolean'
  );
}

export function isSupportTonePresetList(value: unknown): value is readonly SupportTonePresetDto[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (!isSupportTonePresetDto(item) || ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
  }

  return SUPPORT_TONE_IDS.every((id) => ids.has(id));
}

export function isAgentSettingsDto(value: unknown): value is AgentSettingsDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === AGENT_SETTINGS_SCHEMA_VERSION &&
    isNonEmptyString(value.assistantName) &&
    isNonEmptyString(value.greeting) &&
    isNullableString(value.signature) &&
    isSupportToneId(value.selectedToneId) &&
    isNonEmptyString(value.systemInstructions) &&
    isStringArray(value.allowedTopics) &&
    isStringArray(value.forbiddenTopics) &&
    isStringArray(value.escalateWhen) &&
    isNonEmptyString(value.language) &&
    typeof value.collectContactInfo === 'boolean' &&
    typeof value.handoffToHuman === 'boolean' &&
    isAutonomyTurns(value.maxAutonomyTurns)
  );
}

export function isOnboardingSetupDraftDto(value: unknown): value is OnboardingSetupDraftDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBusinessProfileDto(value.businessProfile) &&
    isSupportTonePresetList(value.tonePresets) &&
    isSupportToneId(value.selectedToneId) &&
    isAgentSettingsDto(value.agentSettings) &&
    value.agentSettings.selectedToneId === value.selectedToneId &&
    value.tonePresets.some((preset) => preset.id === value.selectedToneId)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAutonomyTurns(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20;
}
