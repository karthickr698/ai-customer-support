import { TOOL_NAMES, type ToolName, isToolName } from './tools.js';

export const AI_AGENT_CONFIGURATION_SCHEMA_VERSION = 1 as const;

export const AI_AGENT_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'] as const;
export type AiAgentModelId = (typeof AI_AGENT_MODELS)[number];

export const AI_AGENT_FALLBACK_MODES = ['provider_then_heuristic', 'canned_reply', 'handoff'] as const;
export type AiAgentFallbackMode = (typeof AI_AGENT_FALLBACK_MODES)[number];

export const AI_AGENT_CITATION_POLICIES = ['required', 'preferred', 'off'] as const;
export type AiAgentCitationPolicy = (typeof AI_AGENT_CITATION_POLICIES)[number];

export const DEFAULT_AI_AGENT_ENABLED_TOOLS: readonly ToolName[] = TOOL_NAMES;

export type AiAgentRuntimeConfigDto = {
  readonly schemaVersion: typeof AI_AGENT_CONFIGURATION_SCHEMA_VERSION;
  readonly model: AiAgentModelId;
  readonly qualityModel: AiAgentModelId;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly maxInputTokens: number;
  readonly systemPrompt: string;
  readonly enabledTools: readonly ToolName[];
  readonly fallbackMode: AiAgentFallbackMode;
  readonly fallbackReply: string | null;
  readonly fallbackMaxRetries: number;
  readonly citationPolicy: AiAgentCitationPolicy;
  readonly refuseUnknown: boolean;
  readonly refuseOffTopic: boolean;
  readonly languageLock: boolean;
  readonly redactPii: boolean;
};

export type AiAgentConfigurationDto = AiAgentRuntimeConfigDto & {
  readonly id: string;
  readonly organizationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type UpdateAiAgentConfigurationRequest = {
  readonly model?: AiAgentModelId;
  readonly qualityModel?: AiAgentModelId;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly maxInputTokens?: number;
  readonly systemPrompt?: string;
  readonly enabledTools?: readonly ToolName[];
  readonly fallbackMode?: AiAgentFallbackMode;
  readonly fallbackReply?: string | null;
  readonly fallbackMaxRetries?: number;
  readonly citationPolicy?: AiAgentCitationPolicy;
  readonly refuseUnknown?: boolean;
  readonly refuseOffTopic?: boolean;
  readonly languageLock?: boolean;
  readonly redactPii?: boolean;
};

export type AiAgentConfigurationCatalogDto = {
  readonly models: readonly AiAgentModelId[];
  readonly tools: readonly ToolName[];
  readonly fallbackModes: readonly AiAgentFallbackMode[];
  readonly citationPolicies: readonly AiAgentCitationPolicy[];
};

export type AiAgentConfigurationResponse = {
  readonly configuration: AiAgentConfigurationDto;
  readonly catalog: AiAgentConfigurationCatalogDto;
};

export function isAiAgentModelId(value: unknown): value is AiAgentModelId {
  return typeof value === 'string' && (AI_AGENT_MODELS as readonly string[]).includes(value);
}

export function isAiAgentFallbackMode(value: unknown): value is AiAgentFallbackMode {
  return typeof value === 'string' && (AI_AGENT_FALLBACK_MODES as readonly string[]).includes(value);
}

export function isAiAgentCitationPolicy(value: unknown): value is AiAgentCitationPolicy {
  return typeof value === 'string' && (AI_AGENT_CITATION_POLICIES as readonly string[]).includes(value);
}

export function isAiAgentRuntimeConfigDto(value: unknown): value is AiAgentRuntimeConfigDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === AI_AGENT_CONFIGURATION_SCHEMA_VERSION &&
    isAiAgentModelId(value.model) &&
    isAiAgentModelId(value.qualityModel) &&
    isTemperature(value.temperature) &&
    isOutputTokens(value.maxOutputTokens) &&
    isInputTokens(value.maxInputTokens) &&
    typeof value.systemPrompt === 'string' &&
    isToolNameArray(value.enabledTools) &&
    isAiAgentFallbackMode(value.fallbackMode) &&
    isNullableString(value.fallbackReply) &&
    isRetryCount(value.fallbackMaxRetries) &&
    isAiAgentCitationPolicy(value.citationPolicy) &&
    typeof value.refuseUnknown === 'boolean' &&
    typeof value.refuseOffTopic === 'boolean' &&
    typeof value.languageLock === 'boolean' &&
    typeof value.redactPii === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isToolNameArray(value: unknown): value is ToolName[] {
  return Array.isArray(value) && value.every(isToolName);
}

function isTemperature(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2;
}

function isOutputTokens(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 64 && value <= 4096;
}

function isInputTokens(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 512 && value <= 32_000;
}

function isRetryCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}
