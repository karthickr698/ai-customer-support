/**
 * Cross-runtime DTOs for structured logs, distributed traces, metrics,
 * AI evaluation records, and failure monitoring.
 */

export const OBSERVABILITY_SERVICES = ['api', 'ai'] as const;
export type ObservabilityService = (typeof OBSERVABILITY_SERVICES)[number];

export const OBSERVABILITY_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type ObservabilityLogLevel = (typeof OBSERVABILITY_LOG_LEVELS)[number];

export const OBSERVABILITY_SPAN_KINDS = ['server', 'client', 'internal'] as const;
export type ObservabilitySpanKind = (typeof OBSERVABILITY_SPAN_KINDS)[number];

export const OBSERVABILITY_SPAN_STATUSES = ['ok', 'error'] as const;
export type ObservabilitySpanStatus = (typeof OBSERVABILITY_SPAN_STATUSES)[number];

export const OBSERVABILITY_METRIC_NAMES = [
  'http.request.count',
  'http.request.duration_ms',
  'http.request.errors',
  'ai.request.count',
  'ai.request.duration_ms',
  'ai.request.errors',
  'ai.tokens.prompt',
  'ai.tokens.completion',
  'ai.evaluation.failed',
] as const;
export type ObservabilityMetricName = (typeof OBSERVABILITY_METRIC_NAMES)[number];

export const OBSERVABILITY_INCIDENT_SOURCES = ['http', 'ai', 'health', 'evaluation'] as const;
export type ObservabilityIncidentSource = (typeof OBSERVABILITY_INCIDENT_SOURCES)[number];

export const OBSERVABILITY_INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ObservabilityIncidentSeverity = (typeof OBSERVABILITY_INCIDENT_SEVERITIES)[number];

export const OBSERVABILITY_INCIDENT_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type ObservabilityIncidentStatus = (typeof OBSERVABILITY_INCIDENT_STATUSES)[number];

export const OBSERVABILITY_EVALUATION_VERDICTS = ['passed', 'degraded', 'failed'] as const;
export type ObservabilityEvaluationVerdict = (typeof OBSERVABILITY_EVALUATION_VERDICTS)[number];

export const OBSERVABILITY_EVALUATION_OPERATIONS = [
  'generate_support_reply',
  'orchestrate_support_turn',
  'detect_intent',
  'propose_tool_calls',
  'apply_tool_results',
  'ingest_knowledge_document',
  'delete_indexed_document',
  'generate_business_profile',
  'generate_support_tone_presets',
  'generate_initial_agent_settings',
  'run_onboarding_setup',
  'http_request',
] as const;
export type ObservabilityEvaluationOperation = (typeof OBSERVABILITY_EVALUATION_OPERATIONS)[number];

export type ObservabilityPeriodDto = {
  readonly from: string;
  readonly to: string;
};

export type ObservabilityLogDto = {
  readonly id: string;
  readonly occurredAt: string;
  readonly level: ObservabilityLogLevel;
  readonly service: ObservabilityService;
  readonly message: string;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly traceId: string | null;
  readonly organizationId: string | null;
  readonly actorId: string | null;
  readonly method: string | null;
  readonly path: string | null;
  readonly route: string | null;
  readonly statusCode: number | null;
  readonly latencyMs: number | null;
  readonly errorCode: string | null;
  readonly attributes: Record<string, unknown> | null;
};

export type ObservabilityLogListResponse = {
  readonly items: readonly ObservabilityLogDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ObservabilitySpanDto = {
  readonly id: string;
  readonly traceId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly service: ObservabilityService;
  readonly kind: ObservabilitySpanKind;
  readonly status: ObservabilitySpanStatus;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly attributes: Record<string, unknown> | null;
};

export type ObservabilityTraceDto = {
  readonly id: string;
  readonly correlationId: string | null;
  readonly organizationId: string | null;
  readonly name: string;
  readonly service: ObservabilityService;
  readonly status: ObservabilitySpanStatus;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly spanCount: number;
};

export type ObservabilityTraceListResponse = {
  readonly items: readonly ObservabilityTraceDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ObservabilityTraceDetailResponse = {
  readonly trace: ObservabilityTraceDto;
  readonly spans: readonly ObservabilitySpanDto[];
};

export type ObservabilityMetricPointDto = {
  readonly name: string;
  readonly labels: Record<string, string>;
  readonly bucketStart: string;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly avg: number;
};

export type ObservabilityMetricSeriesDto = {
  readonly name: string;
  readonly labels: Record<string, string>;
  readonly points: readonly ObservabilityMetricPointDto[];
};

export type ObservabilityMetricsResponse = {
  readonly period: ObservabilityPeriodDto;
  readonly series: readonly ObservabilityMetricSeriesDto[];
};

export type ObservabilityIncidentDto = {
  readonly id: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly message: string;
  readonly source: ObservabilityIncidentSource;
  readonly severity: ObservabilityIncidentSeverity;
  readonly status: ObservabilityIncidentStatus;
  readonly organizationId: string | null;
  readonly errorCode: string | null;
  readonly route: string | null;
  readonly count: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly acknowledgedAt: string | null;
  readonly acknowledgedBy: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
};

export type ObservabilityIncidentResponse = {
  readonly incident: ObservabilityIncidentDto;
};

export type ObservabilityIncidentListResponse = {
  readonly items: readonly ObservabilityIncidentDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ObservabilityAiEvaluationDto = {
  readonly id: string;
  readonly occurredAt: string;
  readonly organizationId: string | null;
  readonly correlationId: string | null;
  readonly traceId: string | null;
  readonly operation: string;
  readonly model: string | null;
  readonly verdict: ObservabilityEvaluationVerdict;
  readonly score: number;
  readonly reason: string | null;
  readonly latencyMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly inputGuardrail: string | null;
  readonly outputGuardrail: string | null;
  readonly citationCount: number;
  readonly errorCode: string | null;
};

export type ObservabilityAiEvaluationResponse = {
  readonly evaluation: ObservabilityAiEvaluationDto;
};

export type ObservabilityAiEvaluationListResponse = {
  readonly items: readonly ObservabilityAiEvaluationDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ObservabilityOverviewResponse = {
  readonly period: ObservabilityPeriodDto;
  readonly requests: {
    readonly total: number;
    readonly errors: number;
    readonly errorRate: number;
    readonly averageLatencyMs: number;
  };
  readonly ai: {
    readonly calls: number;
    readonly errors: number;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly evaluationsFailed: number;
    readonly averageLatencyMs: number;
  };
  readonly traces: {
    readonly total: number;
    readonly errors: number;
  };
  readonly incidents: {
    readonly open: number;
    readonly acknowledged: number;
    readonly resolved: number;
  };
};
