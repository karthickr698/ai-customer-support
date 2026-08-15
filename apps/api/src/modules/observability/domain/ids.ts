export type ObservabilityLogId = string & { readonly __brand: 'ObservabilityLogId' };
export type ObservabilityTraceId = string & { readonly __brand: 'ObservabilityTraceId' };
export type ObservabilitySpanId = string & { readonly __brand: 'ObservabilitySpanId' };
export type ObservabilityMetricBucketId = string & { readonly __brand: 'ObservabilityMetricBucketId' };
export type ObservabilityIncidentId = string & { readonly __brand: 'ObservabilityIncidentId' };
export type ObservabilityAiEvaluationId = string & { readonly __brand: 'ObservabilityAiEvaluationId' };

export function createObservabilityLogId(id: string = crypto.randomUUID()): ObservabilityLogId {
  return id as ObservabilityLogId;
}

export function createObservabilityTraceId(id: string = crypto.randomUUID()): ObservabilityTraceId {
  return id as ObservabilityTraceId;
}

export function createObservabilitySpanId(id: string = crypto.randomUUID()): ObservabilitySpanId {
  return id as ObservabilitySpanId;
}

export function createObservabilityMetricBucketId(
  id: string = crypto.randomUUID(),
): ObservabilityMetricBucketId {
  return id as ObservabilityMetricBucketId;
}

export function createObservabilityIncidentId(id: string = crypto.randomUUID()): ObservabilityIncidentId {
  return id as ObservabilityIncidentId;
}

export function createObservabilityAiEvaluationId(
  id: string = crypto.randomUUID(),
): ObservabilityAiEvaluationId {
  return id as ObservabilityAiEvaluationId;
}
