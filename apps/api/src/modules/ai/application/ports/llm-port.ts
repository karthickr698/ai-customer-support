export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LLMCompletionRequest {
  readonly messages: readonly LLMMessage[];
  readonly correlationId: string;
}

export interface LLMCompletionResult {
  readonly content: string;
  readonly model: string;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
}

export interface LLMPort {
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResult>;
}
