import type { KnowledgeCitationDto, KnowledgeRetrievalFilterDto } from './knowledge.js';
import { isKnowledgeCitationDto } from './knowledge.js';
import type { SupportChatMessageDto, SupportReplyAgentSettingsDto } from './support-reply.js';

export const ORCHESTRATION_SCHEMA_VERSION = 1 as const;

export const SUPPORT_INTENTS = [
  'greeting',
  'smalltalk',
  'question',
  'account_help',
  'order_status',
  'complaint',
  'escalation',
  'unknown',
] as const;

export type SupportIntent = (typeof SUPPORT_INTENTS)[number];

export const MODEL_ROUTE_NAMES = ['fast', 'quality', 'structured'] as const;
export type ModelRouteName = (typeof MODEL_ROUTE_NAMES)[number];

export const GUARDRAIL_VERDICTS = ['passed', 'blocked', 'sanitized'] as const;
export type GuardrailVerdict = (typeof GUARDRAIL_VERDICTS)[number];

export type DetectIntentRequest = {
  readonly visitorMessage: string;
  readonly history?: readonly SupportChatMessageDto[];
  readonly agentSettings?: SupportReplyAgentSettingsDto;
};

export type DetectIntentResponse = {
  readonly schemaVersion: typeof ORCHESTRATION_SCHEMA_VERSION;
  readonly intent: SupportIntent;
  readonly confidence: number;
  readonly shouldEscalate: boolean;
  readonly reasons: readonly string[];
  readonly guardrails: {
    readonly input: GuardrailVerdict;
  };
};

export type OrchestrateSupportTurnRequest = {
  readonly conversationId: string;
  readonly visitorMessage: string;
  readonly history: readonly SupportChatMessageDto[];
  readonly widgetGreeting?: string;
  readonly agentSettings?: SupportReplyAgentSettingsDto;
  readonly topK?: number;
  readonly retrieval?: KnowledgeRetrievalFilterDto;
};

export type OrchestrateSupportTurnResponse = {
  readonly schemaVersion: typeof ORCHESTRATION_SCHEMA_VERSION;
  readonly intent: SupportIntent;
  readonly intentConfidence: number;
  readonly route: ModelRouteName;
  readonly model: string;
  readonly reply: string;
  readonly shouldEscalate: boolean;
  readonly escalationReason: string | null;
  readonly usedFallback: boolean;
  readonly retryCount: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly citations: readonly KnowledgeCitationDto[];
  readonly guardrails: {
    readonly input: GuardrailVerdict;
    readonly output: GuardrailVerdict;
  };
};

export function isSupportIntent(value: unknown): value is SupportIntent {
  return typeof value === 'string' && (SUPPORT_INTENTS as readonly string[]).includes(value);
}

export function isDetectIntentResponse(value: unknown): value is DetectIntentResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const guardrails = record.guardrails;
  const reasons = record.reasons;
  return (
    record.schemaVersion === ORCHESTRATION_SCHEMA_VERSION &&
    isSupportIntent(record.intent) &&
    typeof record.confidence === 'number' &&
    typeof record.shouldEscalate === 'boolean' &&
    Array.isArray(reasons) &&
    reasons.every((item) => typeof item === 'string') &&
    typeof guardrails === 'object' &&
    guardrails !== null &&
    isGuardrailVerdict((guardrails as Record<string, unknown>).input)
  );
}

export function isOrchestrateSupportTurnResponse(
  value: unknown,
): value is OrchestrateSupportTurnResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const citations = record.citations;
  const guardrails = record.guardrails;
  const route = record.route;
  return (
    record.schemaVersion === ORCHESTRATION_SCHEMA_VERSION &&
    isSupportIntent(record.intent) &&
    typeof record.intentConfidence === 'number' &&
    typeof route === 'string' &&
    (MODEL_ROUTE_NAMES as readonly string[]).includes(route) &&
    typeof record.model === 'string' &&
    typeof record.reply === 'string' &&
    record.reply.trim().length > 0 &&
    typeof record.shouldEscalate === 'boolean' &&
    (record.escalationReason === null || typeof record.escalationReason === 'string') &&
    typeof record.usedFallback === 'boolean' &&
    typeof record.retryCount === 'number' &&
    typeof record.promptTokens === 'number' &&
    typeof record.completionTokens === 'number' &&
    Array.isArray(citations) &&
    citations.every(isKnowledgeCitationDto) &&
    typeof guardrails === 'object' &&
    guardrails !== null &&
    isGuardrailVerdict((guardrails as Record<string, unknown>).input) &&
    isGuardrailVerdict((guardrails as Record<string, unknown>).output)
  );
}

function isGuardrailVerdict(value: unknown): value is GuardrailVerdict {
  return typeof value === 'string' && (GUARDRAIL_VERDICTS as readonly string[]).includes(value);
}
