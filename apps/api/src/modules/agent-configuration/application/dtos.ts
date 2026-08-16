import {
  AI_AGENT_CITATION_POLICIES,
  AI_AGENT_CONFIGURATION_SCHEMA_VERSION,
  AI_AGENT_FALLBACK_MODES,
  AI_AGENT_MODELS,
  DEFAULT_AI_AGENT_ENABLED_TOOLS,
  type AiAgentConfigurationCatalogDto,
  type AiAgentConfigurationDto,
  type AiAgentRuntimeConfigDto,
} from '@ai-customer-support/contracts';
import type { AiAgentConfiguration } from '../domain/ai-agent-configuration.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toAiAgentConfigurationDto(
  configuration: AiAgentConfiguration,
): AiAgentConfigurationDto {
  const snapshot = configuration.toSnapshot();
  return {
    schemaVersion: AI_AGENT_CONFIGURATION_SCHEMA_VERSION,
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    model: snapshot.model,
    qualityModel: snapshot.qualityModel,
    temperature: snapshot.temperature,
    maxOutputTokens: snapshot.maxOutputTokens,
    maxInputTokens: snapshot.maxInputTokens,
    systemPrompt: snapshot.systemPrompt,
    enabledTools: snapshot.enabledTools,
    fallbackMode: snapshot.fallbackMode,
    fallbackReply: snapshot.fallbackReply,
    fallbackMaxRetries: snapshot.fallbackMaxRetries,
    citationPolicy: snapshot.citationPolicy,
    refuseUnknown: snapshot.refuseUnknown,
    refuseOffTopic: snapshot.refuseOffTopic,
    languageLock: snapshot.languageLock,
    redactPii: snapshot.redactPii,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toAiAgentRuntimeConfigDto(
  configuration: AiAgentConfiguration,
): AiAgentRuntimeConfigDto {
  const dto = toAiAgentConfigurationDto(configuration);
  return {
    schemaVersion: dto.schemaVersion,
    model: dto.model,
    qualityModel: dto.qualityModel,
    temperature: dto.temperature,
    maxOutputTokens: dto.maxOutputTokens,
    maxInputTokens: dto.maxInputTokens,
    systemPrompt: dto.systemPrompt,
    enabledTools: dto.enabledTools,
    fallbackMode: dto.fallbackMode,
    fallbackReply: dto.fallbackReply,
    fallbackMaxRetries: dto.fallbackMaxRetries,
    citationPolicy: dto.citationPolicy,
    refuseUnknown: dto.refuseUnknown,
    refuseOffTopic: dto.refuseOffTopic,
    languageLock: dto.languageLock,
    redactPii: dto.redactPii,
  };
}

export function aiAgentConfigurationCatalog(): AiAgentConfigurationCatalogDto {
  return {
    models: AI_AGENT_MODELS,
    tools: DEFAULT_AI_AGENT_ENABLED_TOOLS,
    fallbackModes: AI_AGENT_FALLBACK_MODES,
    citationPolicies: AI_AGENT_CITATION_POLICIES,
  };
}
