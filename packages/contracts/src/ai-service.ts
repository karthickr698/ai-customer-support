/**
 * Cross-runtime HTTP contract for the Python AI service.
 * Feature commands add generate/classify/summarize request and response types here.
 */
export type AIServiceHealthResponse = {
  readonly status: 'ok';
  readonly service: 'ai';
};

export function isAIServiceHealthResponse(value: unknown): value is AIServiceHealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.status === 'ok' && record.service === 'ai';
}
