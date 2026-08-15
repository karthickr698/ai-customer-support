import type {
  ObservabilityAiEvaluationDto,
  ObservabilityIncidentDto,
  ObservabilityLogDto,
  ObservabilityMetricPointDto,
  ObservabilitySpanDto,
  ObservabilityTraceDto,
} from '@ai-customer-support/contracts';
import type { ObservabilityAiEvaluation } from '../domain/ai-evaluation.js';
import type { ObservabilityIncident } from '../domain/failure-incident.js';
import type { ObservabilityLogRecord } from '../domain/log-record.js';
import type { ObservabilityMetricSample } from '../domain/metric-sample.js';
import type { ObservabilitySpan } from '../domain/span.js';
import type { ObservabilityTrace } from '../domain/trace.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toLogDto(record: ObservabilityLogRecord): ObservabilityLogDto {
  const snapshot = record.toSnapshot();
  return {
    id: snapshot.id,
    occurredAt: snapshot.occurredAt.toISOString(),
    level: snapshot.level,
    service: snapshot.service,
    message: snapshot.message,
    requestId: snapshot.requestId ?? null,
    correlationId: snapshot.correlationId ?? null,
    traceId: snapshot.traceId ?? null,
    organizationId: snapshot.organizationId ?? null,
    actorId: snapshot.actorId ?? null,
    method: snapshot.method ?? null,
    path: snapshot.path ?? null,
    route: snapshot.route ?? null,
    statusCode: snapshot.statusCode ?? null,
    latencyMs: snapshot.latencyMs ?? null,
    errorCode: snapshot.errorCode ?? null,
    attributes: snapshot.attributes ?? null,
  };
}

export function toTraceDto(trace: ObservabilityTrace): ObservabilityTraceDto {
  const snapshot = trace.toSnapshot();
  return {
    id: snapshot.id,
    correlationId: snapshot.correlationId ?? null,
    organizationId: snapshot.organizationId ?? null,
    name: snapshot.name,
    service: snapshot.service,
    status: snapshot.status,
    startedAt: snapshot.startedAt.toISOString(),
    endedAt: snapshot.endedAt.toISOString(),
    durationMs: snapshot.durationMs,
    spanCount: snapshot.spanCount,
  };
}

export function toSpanDto(span: ObservabilitySpan): ObservabilitySpanDto {
  const snapshot = span.toSnapshot();
  return {
    id: snapshot.id,
    traceId: snapshot.traceId,
    parentSpanId: snapshot.parentSpanId ?? null,
    name: snapshot.name,
    service: snapshot.service,
    kind: snapshot.kind,
    status: snapshot.status,
    startedAt: snapshot.startedAt.toISOString(),
    endedAt: snapshot.endedAt.toISOString(),
    durationMs: snapshot.durationMs,
    attributes: snapshot.attributes ?? null,
  };
}

export function toMetricPointDto(sample: ObservabilityMetricSample): ObservabilityMetricPointDto {
  const snapshot = sample.toSnapshot();
  return {
    name: snapshot.name,
    labels: snapshot.labels,
    bucketStart: snapshot.bucketStart.toISOString(),
    count: snapshot.count,
    sum: snapshot.sum,
    min: snapshot.min,
    max: snapshot.max,
    avg: snapshot.count > 0 ? snapshot.sum / snapshot.count : 0,
  };
}

export function toIncidentDto(incident: ObservabilityIncident): ObservabilityIncidentDto {
  const snapshot = incident.toSnapshot();
  return {
    id: snapshot.id,
    fingerprint: snapshot.fingerprint,
    title: snapshot.title,
    message: snapshot.message,
    source: snapshot.source,
    severity: snapshot.severity,
    status: snapshot.status,
    organizationId: snapshot.organizationId ?? null,
    errorCode: snapshot.errorCode ?? null,
    route: snapshot.route ?? null,
    count: snapshot.count,
    firstSeenAt: snapshot.firstSeenAt.toISOString(),
    lastSeenAt: snapshot.lastSeenAt.toISOString(),
    acknowledgedAt: snapshot.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: snapshot.acknowledgedBy ?? null,
    resolvedAt: snapshot.resolvedAt?.toISOString() ?? null,
    resolvedBy: snapshot.resolvedBy ?? null,
  };
}

export function toEvaluationDto(evaluation: ObservabilityAiEvaluation): ObservabilityAiEvaluationDto {
  const snapshot = evaluation.toSnapshot();
  return {
    id: snapshot.id,
    occurredAt: snapshot.occurredAt.toISOString(),
    organizationId: snapshot.organizationId ?? null,
    correlationId: snapshot.correlationId ?? null,
    traceId: snapshot.traceId ?? null,
    operation: snapshot.operation,
    model: snapshot.model ?? null,
    verdict: snapshot.verdict,
    score: snapshot.score,
    reason: snapshot.reason ?? null,
    latencyMs: snapshot.latencyMs,
    promptTokens: snapshot.promptTokens,
    completionTokens: snapshot.completionTokens,
    inputGuardrail: snapshot.inputGuardrail ?? null,
    outputGuardrail: snapshot.outputGuardrail ?? null,
    citationCount: snapshot.citationCount,
    errorCode: snapshot.errorCode ?? null,
  };
}

export function defaultPeriod(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    to: now,
  };
}

export function parseIsoDate(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
