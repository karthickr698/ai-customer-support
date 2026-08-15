import type { KnowledgeCitationDto, KnowledgeRetrievalFilterDto } from './knowledge.js';
import { isKnowledgeCitationDto } from './knowledge.js';

export type SupportChatMessageDto = {
  readonly role: 'customer' | 'agent' | 'ai' | 'system';
  readonly content: string;
};

export type SupportReplyAgentSettingsDto = {
  readonly assistantName: string;
  readonly greeting: string;
  readonly systemInstructions: string;
  readonly allowedTopics: readonly string[];
  readonly forbiddenTopics: readonly string[];
  readonly language: string;
  readonly escalateWhen: readonly string[];
};

export type GenerateSupportReplyRequest = {
  readonly conversationId: string;
  readonly visitorMessage: string;
  readonly history: readonly SupportChatMessageDto[];
  readonly widgetGreeting?: string;
  readonly agentSettings?: SupportReplyAgentSettingsDto;
  readonly topK?: number;
  readonly retrieval?: KnowledgeRetrievalFilterDto;
};

export type GenerateSupportReplyResponse = {
  readonly content: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly citations: readonly KnowledgeCitationDto[];
};

export type SupportReplyStreamDelta = {
  readonly type: 'delta';
  readonly text: string;
};

export type SupportReplyStreamDone = {
  readonly type: 'done';
  readonly reply: GenerateSupportReplyResponse;
};

export type SupportReplyStreamError = {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
};

export type SupportReplyStreamEvent =
  | SupportReplyStreamDelta
  | SupportReplyStreamDone
  | SupportReplyStreamError;

export function isGenerateSupportReplyResponse(
  value: unknown,
): value is GenerateSupportReplyResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const citations = record.citations;
  return (
    typeof record.content === 'string' &&
    record.content.trim().length > 0 &&
    typeof record.model === 'string' &&
    typeof record.promptTokens === 'number' &&
    typeof record.completionTokens === 'number' &&
    Array.isArray(citations) &&
    citations.every(isKnowledgeCitationDto)
  );
}

export function isSupportReplyStreamEvent(value: unknown): value is SupportReplyStreamEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.type === 'delta') {
    return typeof record.text === 'string';
  }

  if (record.type === 'done') {
    return isGenerateSupportReplyResponse(record.reply);
  }

  if (record.type === 'error') {
    return typeof record.code === 'string' && typeof record.message === 'string';
  }

  return false;
}
