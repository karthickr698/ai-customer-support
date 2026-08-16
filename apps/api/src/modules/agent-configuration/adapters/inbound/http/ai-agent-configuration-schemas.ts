import { z } from 'zod';
import {
  AI_AGENT_CITATION_POLICIES,
  AI_AGENT_FALLBACK_MODES,
  AI_AGENT_MODELS,
  TOOL_NAMES,
} from '@ai-customer-support/contracts';

export const updateAiAgentConfigurationBodySchema = z.object({
  model: z.enum(AI_AGENT_MODELS).optional(),
  qualityModel: z.enum(AI_AGENT_MODELS).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(64).max(4096).optional(),
  maxInputTokens: z.number().int().min(512).max(32_000).optional(),
  systemPrompt: z.string().max(8000).optional(),
  enabledTools: z.array(z.enum(TOOL_NAMES)).max(TOOL_NAMES.length).optional(),
  fallbackMode: z.enum(AI_AGENT_FALLBACK_MODES).optional(),
  fallbackReply: z.string().max(500).nullable().optional(),
  fallbackMaxRetries: z.number().int().min(1).max(5).optional(),
  citationPolicy: z.enum(AI_AGENT_CITATION_POLICIES).optional(),
  refuseUnknown: z.boolean().optional(),
  refuseOffTopic: z.boolean().optional(),
  languageLock: z.boolean().optional(),
  redactPii: z.boolean().optional(),
});
