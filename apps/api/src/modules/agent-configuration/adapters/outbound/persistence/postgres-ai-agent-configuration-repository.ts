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
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AiAgentConfigurationRepository } from '../../../application/ports/ai-agent-configuration-repository.js';
import {
  AiAgentConfiguration,
  type AiAgentConfigurationSnapshot,
} from '../../../domain/ai-agent-configuration.js';
import { createAiAgentConfigurationId } from '../../../domain/ai-agent-configuration-id.js';
import { InvalidAiAgentConfigurationError } from '../../../domain/errors.js';

type ConfigurationRecord = {
  id: string;
  organizationId: string;
  model: string;
  qualityModel: string;
  temperature: number;
  maxOutputTokens: number;
  maxInputTokens: number;
  systemPrompt: string;
  enabledTools: string[];
  fallbackMode: string;
  fallbackReply: string | null;
  fallbackMaxRetries: number;
  citationPolicy: string;
  refuseUnknown: boolean;
  refuseOffTopic: boolean;
  languageLock: boolean;
  redactPii: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresAiAgentConfigurationRepository implements AiAgentConfigurationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenant(tenantId: string): Promise<AiAgentConfiguration | null> {
    const record = await this.prisma.aiAgentConfiguration.findUnique({
      where: { organizationId: tenantId },
    });
    return record ? toConfiguration(record) : null;
  }

  async findById(id: string): Promise<AiAgentConfiguration | null> {
    const record = await this.prisma.aiAgentConfiguration.findUnique({
      where: { id },
    });
    return record ? toConfiguration(record) : null;
  }

  async save(configuration: AiAgentConfiguration): Promise<void> {
    const snapshot = configuration.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.aiAgentConfiguration.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        model: data.model,
        qualityModel: data.qualityModel,
        temperature: data.temperature,
        maxOutputTokens: data.maxOutputTokens,
        maxInputTokens: data.maxInputTokens,
        systemPrompt: data.systemPrompt,
        enabledTools: data.enabledTools,
        fallbackMode: data.fallbackMode,
        fallbackReply: data.fallbackReply,
        fallbackMaxRetries: data.fallbackMaxRetries,
        citationPolicy: data.citationPolicy,
        refuseUnknown: data.refuseUnknown,
        refuseOffTopic: data.refuseOffTopic,
        languageLock: data.languageLock,
        redactPii: data.redactPii,
        updatedAt: data.updatedAt,
      },
    });
  }
}

function toConfiguration(record: ConfigurationRecord): AiAgentConfiguration {
  const snapshot: AiAgentConfigurationSnapshot = {
    id: createAiAgentConfigurationId(record.id),
    organizationId: record.organizationId,
    model: parseModel(record.model),
    qualityModel: parseModel(record.qualityModel),
    temperature: record.temperature,
    maxOutputTokens: record.maxOutputTokens,
    maxInputTokens: record.maxInputTokens,
    systemPrompt: record.systemPrompt,
    enabledTools: parseTools(record.enabledTools),
    fallbackMode: parseFallbackMode(record.fallbackMode),
    fallbackReply: record.fallbackReply,
    fallbackMaxRetries: record.fallbackMaxRetries,
    citationPolicy: parseCitationPolicy(record.citationPolicy),
    refuseUnknown: record.refuseUnknown,
    refuseOffTopic: record.refuseOffTopic,
    languageLock: record.languageLock,
    redactPii: record.redactPii,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return AiAgentConfiguration.reconstitute(snapshot);
}

function toRecord(
  snapshot: AiAgentConfigurationSnapshot,
): Prisma.AiAgentConfigurationUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    model: snapshot.model,
    qualityModel: snapshot.qualityModel,
    temperature: snapshot.temperature,
    maxOutputTokens: snapshot.maxOutputTokens,
    maxInputTokens: snapshot.maxInputTokens,
    systemPrompt: snapshot.systemPrompt,
    enabledTools: [...snapshot.enabledTools],
    fallbackMode: snapshot.fallbackMode,
    fallbackReply: snapshot.fallbackReply,
    fallbackMaxRetries: snapshot.fallbackMaxRetries,
    citationPolicy: snapshot.citationPolicy,
    refuseUnknown: snapshot.refuseUnknown,
    refuseOffTopic: snapshot.refuseOffTopic,
    languageLock: snapshot.languageLock,
    redactPii: snapshot.redactPii,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function parseModel(value: string): AiAgentModelId {
  if ((AI_AGENT_MODELS as readonly string[]).includes(value)) {
    return value as AiAgentModelId;
  }
  throw new InvalidAiAgentConfigurationError('Stored model is not supported');
}

function parseFallbackMode(value: string): AiAgentFallbackMode {
  if ((AI_AGENT_FALLBACK_MODES as readonly string[]).includes(value)) {
    return value as AiAgentFallbackMode;
  }
  throw new InvalidAiAgentConfigurationError('Stored fallback mode is not supported');
}

function parseCitationPolicy(value: string): AiAgentCitationPolicy {
  if ((AI_AGENT_CITATION_POLICIES as readonly string[]).includes(value)) {
    return value as AiAgentCitationPolicy;
  }
  throw new InvalidAiAgentConfigurationError('Stored citation policy is not supported');
}

function parseTools(values: readonly string[]): ToolName[] {
  return values.filter((value): value is ToolName =>
    (DEFAULT_AI_AGENT_ENABLED_TOOLS as readonly string[]).includes(value),
  );
}
