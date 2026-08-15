import type { ObservabilityEvaluationVerdict } from '@ai-customer-support/contracts';
import { createObservabilityAiEvaluationId, type ObservabilityAiEvaluationId } from './ids.js';
import { clampScore, parseEvaluationVerdict, redactAttributes } from './values.js';

export type ObservabilityAiEvaluationSnapshot = {
  readonly id: ObservabilityAiEvaluationId;
  readonly occurredAt: Date;
  readonly organizationId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly operation: string;
  readonly model?: string;
  readonly verdict: ObservabilityEvaluationVerdict;
  readonly score: number;
  readonly reason?: string;
  readonly latencyMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly inputGuardrail?: string;
  readonly outputGuardrail?: string;
  readonly citationCount: number;
  readonly errorCode?: string;
  readonly attributes?: Record<string, unknown>;
};

export class ObservabilityAiEvaluation {
  private constructor(private readonly snapshot: ObservabilityAiEvaluationSnapshot) {}

  static create(
    input: Omit<ObservabilityAiEvaluationSnapshot, 'id' | 'score' | 'verdict'> & {
      readonly id?: string;
      readonly verdict: ObservabilityEvaluationVerdict;
      readonly score: number;
    },
  ): ObservabilityAiEvaluation {
    return new ObservabilityAiEvaluation({
      ...input,
      id: createObservabilityAiEvaluationId(input.id),
      operation: input.operation.trim() || 'http_request',
      verdict: parseEvaluationVerdict(input.verdict),
      score: clampScore(input.score),
      latencyMs: Math.max(0, Math.trunc(input.latencyMs)),
      promptTokens: Math.max(0, Math.trunc(input.promptTokens)),
      completionTokens: Math.max(0, Math.trunc(input.completionTokens)),
      citationCount: Math.max(0, Math.trunc(input.citationCount)),
      attributes: redactAttributes(input.attributes),
    });
  }

  static rehydrate(snapshot: ObservabilityAiEvaluationSnapshot): ObservabilityAiEvaluation {
    return new ObservabilityAiEvaluation({
      ...snapshot,
      id: createObservabilityAiEvaluationId(snapshot.id),
      verdict: parseEvaluationVerdict(snapshot.verdict),
      score: clampScore(snapshot.score),
      attributes: redactAttributes(snapshot.attributes),
    });
  }

  get verdict(): ObservabilityEvaluationVerdict {
    return this.snapshot.verdict;
  }

  toSnapshot(): ObservabilityAiEvaluationSnapshot {
    return this.snapshot;
  }
}
