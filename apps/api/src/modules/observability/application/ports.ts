import type { Page, PageRequest } from '@ai-customer-support/shared';
import type {
  ObservabilityEvaluationVerdict,
  ObservabilityIncidentStatus,
  ObservabilityLogLevel,
  ObservabilityService,
  ObservabilitySpanStatus,
} from '@ai-customer-support/contracts';
import type { ObservabilityAiEvaluation } from '../domain/ai-evaluation.js';
import type { ObservabilityIncident } from '../domain/failure-incident.js';
import type { ObservabilityLogRecord } from '../domain/log-record.js';
import type { ObservabilityMetricSample } from '../domain/metric-sample.js';
import type { ObservabilitySpan } from '../domain/span.js';
import type { ObservabilityTrace } from '../domain/trace.js';
import type {
  ObservabilityAiEvaluationId,
  ObservabilityIncidentId,
  ObservabilityTraceId,
} from '../domain/ids.js';

export type ObservabilityActor = {
  readonly actorId: string;
  readonly permissions: readonly string[];
  readonly organizationId?: string;
};

export interface ClockPort {
  now(): Date;
}

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<ObservabilityActor>;
}

export interface PlatformAccessPort {
  loadActor(actorId: string): Promise<ObservabilityActor>;
}

export type TimeRange = {
  readonly from: Date;
  readonly to: Date;
};

export type ObservabilityLogFilter = {
  readonly organizationId?: string;
  readonly level?: ObservabilityLogLevel;
  readonly service?: ObservabilityService;
  readonly route?: string;
  readonly traceId?: string;
  readonly errorCode?: string;
  readonly from?: Date;
  readonly to?: Date;
};

export interface ObservabilityLogRepository {
  save(record: ObservabilityLogRecord): Promise<void>;
  list(page: PageRequest, filter: ObservabilityLogFilter): Promise<Page<ObservabilityLogRecord>>;
}

export type ObservabilityTraceFilter = {
  readonly organizationId?: string;
  readonly status?: ObservabilitySpanStatus;
  readonly service?: ObservabilityService;
  readonly from?: Date;
  readonly to?: Date;
};

export interface ObservabilityTraceRepository {
  save(trace: ObservabilityTrace, spans: readonly ObservabilitySpan[]): Promise<void>;
  addSpan(traceId: ObservabilityTraceId, span: ObservabilitySpan, endedAt: Date): Promise<void>;
  findById(id: ObservabilityTraceId, organizationId?: string): Promise<{
    readonly trace: ObservabilityTrace;
    readonly spans: readonly ObservabilitySpan[];
  } | null>;
  list(page: PageRequest, filter: ObservabilityTraceFilter): Promise<Page<ObservabilityTrace>>;
  count(filter: ObservabilityTraceFilter): Promise<{ readonly total: number; readonly errors: number }>;
}

export type MetricRecordInput = {
  readonly name: string;
  readonly labels: Record<string, string>;
  readonly labelsHash: string;
  readonly organizationId?: string;
  readonly occurredAt: Date;
  readonly value: number;
};

export type ObservabilityMetricFilter = {
  readonly organizationId?: string;
  readonly names?: readonly string[];
  readonly from: Date;
  readonly to: Date;
};

export interface ObservabilityMetricRepository {
  record(sample: ObservabilityMetricSample): Promise<void>;
  list(filter: ObservabilityMetricFilter): Promise<readonly ObservabilityMetricSample[]>;
  summarize(
    organizationId: string | undefined,
    range: TimeRange,
  ): Promise<{
    readonly httpCount: number;
    readonly httpErrors: number;
    readonly httpLatencySum: number;
    readonly aiCount: number;
    readonly aiErrors: number;
    readonly aiLatencySum: number;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly evaluationsFailed: number;
  }>;
}

export type ObservabilityIncidentFilter = {
  readonly organizationId?: string;
  readonly status?: ObservabilityIncidentStatus;
  readonly source?: string;
  readonly from?: Date;
  readonly to?: Date;
};

export interface ObservabilityIncidentRepository {
  save(incident: ObservabilityIncident): Promise<void>;
  findById(id: ObservabilityIncidentId, organizationId?: string): Promise<ObservabilityIncident | null>;
  findOpenByFingerprint(fingerprint: string, organizationId?: string): Promise<ObservabilityIncident | null>;
  list(page: PageRequest, filter: ObservabilityIncidentFilter): Promise<Page<ObservabilityIncident>>;
  countByStatus(organizationId: string | undefined): Promise<{
    readonly open: number;
    readonly acknowledged: number;
    readonly resolved: number;
  }>;
}

export type ObservabilityEvaluationFilter = {
  readonly organizationId?: string;
  readonly verdict?: ObservabilityEvaluationVerdict;
  readonly operation?: string;
  readonly from?: Date;
  readonly to?: Date;
};

export interface ObservabilityAiEvaluationRepository {
  save(evaluation: ObservabilityAiEvaluation): Promise<void>;
  findById(
    id: ObservabilityAiEvaluationId,
    organizationId?: string,
  ): Promise<ObservabilityAiEvaluation | null>;
  list(page: PageRequest, filter: ObservabilityEvaluationFilter): Promise<Page<ObservabilityAiEvaluation>>;
}

export type ErrorRateWindow = {
  readonly total: number;
  readonly errors: number;
};

export interface ErrorRateWindowPort {
  increment(input: {
    readonly key: string;
    readonly isError: boolean;
    readonly windowSeconds: number;
  }): Promise<ErrorRateWindow>;
  incrementFailures(key: string, windowSeconds: number): Promise<number>;
  resetFailures(key: string): Promise<void>;
}
