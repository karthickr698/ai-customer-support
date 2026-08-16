import {
  AI_AGENT_CITATION_POLICIES,
  AI_AGENT_FALLBACK_MODES,
  AI_AGENT_MODELS,
  DEFAULT_AI_AGENT_ENABLED_TOOLS,
  type AiAgentCitationPolicy,
  type AiAgentFallbackMode,
  type AiAgentModelId,
  type ToolName,
} from '@ai-customer-support/contracts';
import { InvalidAiAgentConfigurationError } from './errors.js';
import {
  createAiAgentConfigurationId,
  type AiAgentConfigurationId,
} from './ai-agent-configuration-id.js';

const DEFAULT_FALLBACK_REPLY =
  "I'm having trouble answering right now. I can connect you with a teammate who can help.";

export type AiAgentConfigurationSnapshot = {
  readonly id: AiAgentConfigurationId;
  readonly organizationId: string;
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
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type AiAgentConfigurationPatch = {
  readonly model?: string;
  readonly qualityModel?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly maxInputTokens?: number;
  readonly systemPrompt?: string;
  readonly enabledTools?: readonly string[];
  readonly fallbackMode?: string;
  readonly fallbackReply?: string | null;
  readonly fallbackMaxRetries?: number;
  readonly citationPolicy?: string;
  readonly refuseUnknown?: boolean;
  readonly refuseOffTopic?: boolean;
  readonly languageLock?: boolean;
  readonly redactPii?: boolean;
};

export class AiAgentConfiguration {
  private constructor(
    readonly id: AiAgentConfigurationId,
    readonly organizationId: string,
    private modelValue: AiAgentModelId,
    private qualityModelValue: AiAgentModelId,
    private temperatureValue: number,
    private maxOutputTokensValue: number,
    private maxInputTokensValue: number,
    private systemPromptValue: string,
    private enabledToolsValue: ToolName[],
    private fallbackModeValue: AiAgentFallbackMode,
    private fallbackReplyValue: string | null,
    private fallbackMaxRetriesValue: number,
    private citationPolicyValue: AiAgentCitationPolicy,
    private refuseUnknownValue: boolean,
    private refuseOffTopicValue: boolean,
    private languageLockValue: boolean,
    private redactPiiValue: boolean,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static createDefault(input: {
    readonly organizationId: string;
    readonly now: Date;
    readonly id?: AiAgentConfigurationId;
  }): AiAgentConfiguration {
    return new AiAgentConfiguration(
      input.id ?? createAiAgentConfigurationId(),
      input.organizationId,
      'gpt-4o-mini',
      'gpt-4o',
      0.3,
      1024,
      8000,
      '',
      [...DEFAULT_AI_AGENT_ENABLED_TOOLS],
      'provider_then_heuristic',
      DEFAULT_FALLBACK_REPLY,
      3,
      'preferred',
      true,
      true,
      true,
      false,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: AiAgentConfigurationSnapshot): AiAgentConfiguration {
    return new AiAgentConfiguration(
      snapshot.id,
      snapshot.organizationId,
      snapshot.model,
      snapshot.qualityModel,
      snapshot.temperature,
      snapshot.maxOutputTokens,
      snapshot.maxInputTokens,
      snapshot.systemPrompt,
      [...snapshot.enabledTools],
      snapshot.fallbackMode,
      snapshot.fallbackReply,
      snapshot.fallbackMaxRetries,
      snapshot.citationPolicy,
      snapshot.refuseUnknown,
      snapshot.refuseOffTopic,
      snapshot.languageLock,
      snapshot.redactPii,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  update(patch: AiAgentConfigurationPatch, now: Date): void {
    if (patch.model !== undefined) {
      this.modelValue = parseModel(patch.model, 'Model');
    }
    if (patch.qualityModel !== undefined) {
      this.qualityModelValue = parseModel(patch.qualityModel, 'Quality model');
    }
    if (patch.temperature !== undefined) {
      this.temperatureValue = parseTemperature(patch.temperature);
    }
    if (patch.maxOutputTokens !== undefined) {
      this.maxOutputTokensValue = parseInteger(patch.maxOutputTokens, 'Max output tokens', 64, 4096);
    }
    if (patch.maxInputTokens !== undefined) {
      this.maxInputTokensValue = parseInteger(patch.maxInputTokens, 'Max input tokens', 512, 32_000);
    }
    if (patch.systemPrompt !== undefined) {
      this.systemPromptValue = normalizePrompt(patch.systemPrompt);
    }
    if (patch.enabledTools !== undefined) {
      this.enabledToolsValue = parseTools(patch.enabledTools);
    }
    if (patch.fallbackMode !== undefined) {
      this.fallbackModeValue = parseFallbackMode(patch.fallbackMode);
    }
    if (patch.fallbackReply !== undefined) {
      this.fallbackReplyValue = normalizeFallbackReply(patch.fallbackReply);
    }
    if (patch.fallbackMaxRetries !== undefined) {
      this.fallbackMaxRetriesValue = parseInteger(patch.fallbackMaxRetries, 'Fallback retries', 1, 5);
    }
    if (patch.citationPolicy !== undefined) {
      this.citationPolicyValue = parseCitationPolicy(patch.citationPolicy);
    }
    if (patch.refuseUnknown !== undefined) {
      this.refuseUnknownValue = patch.refuseUnknown;
    }
    if (patch.refuseOffTopic !== undefined) {
      this.refuseOffTopicValue = patch.refuseOffTopic;
    }
    if (patch.languageLock !== undefined) {
      this.languageLockValue = patch.languageLock;
    }
    if (patch.redactPii !== undefined) {
      this.redactPiiValue = patch.redactPii;
    }

    this.updatedAtValue = now;
  }

  toSnapshot(): AiAgentConfigurationSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      model: this.modelValue,
      qualityModel: this.qualityModelValue,
      temperature: this.temperatureValue,
      maxOutputTokens: this.maxOutputTokensValue,
      maxInputTokens: this.maxInputTokensValue,
      systemPrompt: this.systemPromptValue,
      enabledTools: this.enabledToolsValue,
      fallbackMode: this.fallbackModeValue,
      fallbackReply: this.fallbackReplyValue,
      fallbackMaxRetries: this.fallbackMaxRetriesValue,
      citationPolicy: this.citationPolicyValue,
      refuseUnknown: this.refuseUnknownValue,
      refuseOffTopic: this.refuseOffTopicValue,
      languageLock: this.languageLockValue,
      redactPii: this.redactPiiValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function parseModel(raw: string, label: string): AiAgentModelId {
  if ((AI_AGENT_MODELS as readonly string[]).includes(raw)) {
    return raw as AiAgentModelId;
  }
  throw new InvalidAiAgentConfigurationError(`${label} is not a supported model`);
}

function parseTemperature(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 2) {
    throw new InvalidAiAgentConfigurationError('Temperature must be between 0 and 2');
  }
  return Math.round(value * 100) / 100;
}

function parseInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidAiAgentConfigurationError(`${label} must be a whole number between ${min} and ${max}`);
  }
  return value;
}

function normalizePrompt(raw: string): string {
  if (raw.length > 8000) {
    throw new InvalidAiAgentConfigurationError('System prompt must be at most 8000 characters');
  }
  return raw.trim();
}

function parseTools(values: readonly string[]): ToolName[] {
  if (values.length > DEFAULT_AI_AGENT_ENABLED_TOOLS.length) {
    throw new InvalidAiAgentConfigurationError('Too many tools selected');
  }

  const unique: ToolName[] = [];
  for (const value of values) {
    if (!(DEFAULT_AI_AGENT_ENABLED_TOOLS as readonly string[]).includes(value)) {
      throw new InvalidAiAgentConfigurationError(`Unknown tool: ${value}`);
    }
    const name = value as ToolName;
    if (!unique.includes(name)) {
      unique.push(name);
    }
  }
  return unique;
}

function parseFallbackMode(raw: string): AiAgentFallbackMode {
  if ((AI_AGENT_FALLBACK_MODES as readonly string[]).includes(raw)) {
    return raw as AiAgentFallbackMode;
  }
  throw new InvalidAiAgentConfigurationError('Fallback mode is not supported');
}

function normalizeFallbackReply(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }
  if (value.length > 500) {
    throw new InvalidAiAgentConfigurationError('Fallback reply must be at most 500 characters');
  }
  return value;
}

function parseCitationPolicy(raw: string): AiAgentCitationPolicy {
  if ((AI_AGENT_CITATION_POLICIES as readonly string[]).includes(raw)) {
    return raw as AiAgentCitationPolicy;
  }
  throw new InvalidAiAgentConfigurationError('Citation policy is not supported');
}
