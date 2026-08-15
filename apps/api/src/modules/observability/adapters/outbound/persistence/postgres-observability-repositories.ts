import type { Page, PageRequest } from '@ai-customer-support/shared';
import { Prisma, type PrismaClient } from '@prisma/client';
import { ObservabilityAiEvaluation } from '../../../domain/ai-evaluation.js';
import { ObservabilityIncident } from '../../../domain/failure-incident.js';
import {
  createObservabilityAiEvaluationId,
  createObservabilityIncidentId,
  createObservabilityLogId,
  createObservabilityMetricBucketId,
  createObservabilitySpanId,
  createObservabilityTraceId,
  type ObservabilityAiEvaluationId,
  type ObservabilityIncidentId,
  type ObservabilityTraceId,
} from '../../../domain/ids.js';
import { ObservabilityLogRecord } from '../../../domain/log-record.js';
import { ObservabilityMetricSample } from '../../../domain/metric-sample.js';
import { ObservabilitySpan } from '../../../domain/span.js';
import { ObservabilityTrace } from '../../../domain/trace.js';
import {
  jsonRecord,
  parseEvaluationVerdict,
  parseIncidentSeverity,
  parseIncidentSource,
  parseIncidentStatus,
  parseLogLevel,
  parseService,
  parseSpanKind,
  parseSpanStatus,
  stringRecord,
} from '../../../domain/values.js';
import type {
  ObservabilityAiEvaluationRepository,
  ObservabilityEvaluationFilter,
  ObservabilityIncidentFilter,
  ObservabilityIncidentRepository,
  ObservabilityLogFilter,
  ObservabilityLogRepository,
  ObservabilityMetricFilter,
  ObservabilityMetricRepository,
  ObservabilityTraceFilter,
  ObservabilityTraceRepository,
  TimeRange,
} from '../../../application/ports.js';

export class PostgresObservabilityLogRepository implements ObservabilityLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(record: ObservabilityLogRecord): Promise<void> {
    const snapshot = record.toSnapshot();
    await this.prisma.observabilityLog.create({
      data: {
        id: snapshot.id,
        occurredAt: snapshot.occurredAt,
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
        attributes: toJson(snapshot.attributes),
      },
    });
  }

  async list(page: PageRequest, filter: ObservabilityLogFilter): Promise<Page<ObservabilityLogRecord>> {
    const skip = (page.page - 1) * page.pageSize;
    const where: Prisma.ObservabilityLogWhereInput = {
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
      ...(filter.level ? { level: filter.level } : {}),
      ...(filter.service ? { service: filter.service } : {}),
      ...(filter.route ? { route: filter.route } : {}),
      ...(filter.traceId ? { traceId: filter.traceId } : {}),
      ...(filter.errorCode ? { errorCode: filter.errorCode } : {}),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.observabilityLog.count({ where }),
      this.prisma.observabilityLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return { items: records.map(toLog), total, page: page.page, pageSize: page.pageSize };
  }
}

export class PostgresObservabilityTraceRepository implements ObservabilityTraceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(trace: ObservabilityTrace, spans: readonly ObservabilitySpan[]): Promise<void> {
    const snapshot = trace.toSnapshot();
    await this.prisma.observabilityTrace.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        correlationId: snapshot.correlationId ?? null,
        organizationId: snapshot.organizationId ?? null,
        name: snapshot.name,
        service: snapshot.service,
        status: snapshot.status,
        startedAt: snapshot.startedAt,
        endedAt: snapshot.endedAt,
        durationMs: snapshot.durationMs,
        spanCount: snapshot.spanCount,
      },
      update: {
        endedAt: snapshot.endedAt,
        durationMs: snapshot.durationMs,
        ...(snapshot.status === 'error' ? { status: 'error' as const } : {}),
      },
    });
    for (const span of spans) {
      await this.prisma.observabilitySpan.create({ data: toSpanCreate(span) }).catch(() => undefined);
    }
    const spanCount = await this.prisma.observabilitySpan.count({ where: { traceId: snapshot.id } });
    await this.prisma.observabilityTrace.update({
      where: { id: snapshot.id },
      data: { spanCount },
    });
  }

  async addSpan(traceId: ObservabilityTraceId, span: ObservabilitySpan, endedAt: Date): Promise<void> {
    const snapshot = span.toSnapshot();
    const existing = await this.prisma.observabilityTrace.findUnique({ where: { id: traceId } });
    if (!existing) {
      await this.prisma.observabilityTrace.create({
        data: {
          id: traceId,
          correlationId: typeof snapshot.attributes?.correlationId === 'string' ? snapshot.attributes.correlationId : null,
          organizationId: null,
          name: snapshot.name,
          service: snapshot.service,
          status: snapshot.status,
          startedAt: snapshot.startedAt,
          endedAt,
          durationMs: snapshot.durationMs,
          spanCount: 1,
        },
      });
      await this.prisma.observabilitySpan.create({ data: toSpanCreate(span) });
      return;
    }
    const status = existing.status === 'error' || snapshot.status === 'error' ? 'error' : 'ok';
    const nextEnded = endedAt > existing.endedAt ? endedAt : existing.endedAt;
    await this.prisma.$transaction([
      this.prisma.observabilitySpan.create({ data: toSpanCreate(span) }),
      this.prisma.observabilityTrace.update({
        where: { id: traceId },
        data: {
          spanCount: { increment: 1 },
          status,
          endedAt: nextEnded,
          durationMs: Math.max(existing.durationMs, nextEnded.getTime() - existing.startedAt.getTime()),
        },
      }),
    ]);
  }

  async findById(id: ObservabilityTraceId, organizationId?: string) {
    const record = await this.prisma.observabilityTrace.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: { spans: { orderBy: { startedAt: 'asc' } } },
    });
    if (!record) {
      return null;
    }
    return {
      trace: toTrace(record),
      spans: record.spans.map(toSpan),
    };
  }

  async list(page: PageRequest, filter: ObservabilityTraceFilter): Promise<Page<ObservabilityTrace>> {
    const skip = (page.page - 1) * page.pageSize;
    const where = traceWhere(filter);
    const [total, records] = await this.prisma.$transaction([
      this.prisma.observabilityTrace.count({ where }),
      this.prisma.observabilityTrace.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return { items: records.map(toTrace), total, page: page.page, pageSize: page.pageSize };
  }

  async count(filter: ObservabilityTraceFilter): Promise<{ readonly total: number; readonly errors: number }> {
    const where = traceWhere(filter);
    const [total, errors] = await Promise.all([
      this.prisma.observabilityTrace.count({ where }),
      this.prisma.observabilityTrace.count({ where: { ...where, status: 'error' } }),
    ]);
    return { total, errors };
  }
}

export class PostgresObservabilityMetricRepository implements ObservabilityMetricRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(sample: ObservabilityMetricSample): Promise<void> {
    const snapshot = sample.toSnapshot();
    await this.prisma.$executeRaw`
      INSERT INTO observability_metric_buckets
        (id, name, labels_hash, labels, bucket_start, organization_id, count, sum, min, max)
      VALUES
        (${snapshot.id}::uuid, ${snapshot.name}, ${snapshot.labelsHash}, ${JSON.stringify(snapshot.labels)}::jsonb,
         ${snapshot.bucketStart}, ${snapshot.organizationId ?? null}::uuid, ${snapshot.count}, ${snapshot.sum},
         ${snapshot.min}, ${snapshot.max})
      ON CONFLICT (name, labels_hash, bucket_start)
      DO UPDATE SET
        count = observability_metric_buckets.count + EXCLUDED.count,
        sum = observability_metric_buckets.sum + EXCLUDED.sum,
        min = LEAST(observability_metric_buckets.min, EXCLUDED.min),
        max = GREATEST(observability_metric_buckets.max, EXCLUDED.max)
    `;
  }

  async list(filter: ObservabilityMetricFilter): Promise<readonly ObservabilityMetricSample[]> {
    const records = await this.prisma.observabilityMetricBucket.findMany({
      where: {
        ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
        ...(filter.names && filter.names.length > 0 ? { name: { in: [...filter.names] } } : {}),
        bucketStart: { gte: filter.from, lte: filter.to },
      },
      orderBy: [{ name: 'asc' }, { bucketStart: 'asc' }],
    });
    return records.map(toMetric);
  }

  async summarize(organizationId: string | undefined, range: TimeRange) {
    const orgClause = organizationId
      ? Prisma.sql`AND organization_id = ${organizationId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{
        name: string;
        count: bigint;
        sum: number;
      }>
    >`
      SELECT name, SUM(count)::bigint AS count, SUM(sum)::double precision AS sum
      FROM observability_metric_buckets
      WHERE bucket_start >= ${range.from} AND bucket_start <= ${range.to}
      ${orgClause}
      GROUP BY name
    `;
    const byName = new Map(rows.map((row) => [row.name, { count: Number(row.count), sum: row.sum }] as const));
    const httpCount = byName.get('http.request.count')?.count ?? 0;
    const aiCount = byName.get('ai.request.count')?.count ?? 0;
    return {
      httpCount,
      httpErrors: byName.get('http.request.errors')?.count ?? 0,
      httpLatencySum: byName.get('http.request.duration_ms')?.sum ?? 0,
      aiCount,
      aiErrors: byName.get('ai.request.errors')?.count ?? 0,
      aiLatencySum: byName.get('ai.request.duration_ms')?.sum ?? 0,
      promptTokens: byName.get('ai.tokens.prompt')?.sum ?? 0,
      completionTokens: byName.get('ai.tokens.completion')?.sum ?? 0,
      evaluationsFailed: byName.get('ai.evaluation.failed')?.count ?? 0,
    };
  }
}

export class PostgresObservabilityIncidentRepository implements ObservabilityIncidentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(incident: ObservabilityIncident): Promise<void> {
    const snapshot = incident.toSnapshot();
    await this.prisma.observabilityIncident.upsert({
      where: { id: snapshot.id },
      create: toIncidentRecord(snapshot),
      update: {
        title: snapshot.title,
        message: snapshot.message,
        severity: snapshot.severity,
        status: snapshot.status,
        count: snapshot.count,
        lastSeenAt: snapshot.lastSeenAt,
        acknowledgedAt: snapshot.acknowledgedAt ?? null,
        acknowledgedBy: snapshot.acknowledgedBy ?? null,
        resolvedAt: snapshot.resolvedAt ?? null,
        resolvedBy: snapshot.resolvedBy ?? null,
      },
    });
  }

  async findById(id: ObservabilityIncidentId, organizationId?: string) {
    const record = await this.prisma.observabilityIncident.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
    });
    return record ? toIncident(record) : null;
  }

  async findOpenByFingerprint(fingerprint: string, organizationId?: string) {
    const record = await this.prisma.observabilityIncident.findFirst({
      where: {
        fingerprint,
        status: { in: ['open', 'acknowledged'] },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    return record ? toIncident(record) : null;
  }

  async list(page: PageRequest, filter: ObservabilityIncidentFilter): Promise<Page<ObservabilityIncident>> {
    const skip = (page.page - 1) * page.pageSize;
    const where: Prisma.ObservabilityIncidentWhereInput = {
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.from || filter.to
        ? {
            lastSeenAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.observabilityIncident.count({ where }),
      this.prisma.observabilityIncident.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return { items: records.map(toIncident), total, page: page.page, pageSize: page.pageSize };
  }

  async countByStatus(organizationId: string | undefined) {
    const where = organizationId ? { organizationId } : {};
    const [open, acknowledged, resolved] = await Promise.all([
      this.prisma.observabilityIncident.count({ where: { ...where, status: 'open' } }),
      this.prisma.observabilityIncident.count({ where: { ...where, status: 'acknowledged' } }),
      this.prisma.observabilityIncident.count({ where: { ...where, status: 'resolved' } }),
    ]);
    return { open, acknowledged, resolved };
  }
}

export class PostgresObservabilityAiEvaluationRepository implements ObservabilityAiEvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(evaluation: ObservabilityAiEvaluation): Promise<void> {
    const snapshot = evaluation.toSnapshot();
    await this.prisma.observabilityAiEvaluation.create({
      data: {
        id: snapshot.id,
        occurredAt: snapshot.occurredAt,
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
        attributes: toJson(snapshot.attributes),
      },
    });
  }

  async findById(id: ObservabilityAiEvaluationId, organizationId?: string) {
    const record = await this.prisma.observabilityAiEvaluation.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
    });
    return record ? toEvaluation(record) : null;
  }

  async list(
    page: PageRequest,
    filter: ObservabilityEvaluationFilter,
  ): Promise<Page<ObservabilityAiEvaluation>> {
    const skip = (page.page - 1) * page.pageSize;
    const where: Prisma.ObservabilityAiEvaluationWhereInput = {
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
      ...(filter.verdict ? { verdict: filter.verdict } : {}),
      ...(filter.operation ? { operation: filter.operation } : {}),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.observabilityAiEvaluation.count({ where }),
      this.prisma.observabilityAiEvaluation.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);
    return { items: records.map(toEvaluation), total, page: page.page, pageSize: page.pageSize };
  }
}

function traceWhere(filter: ObservabilityTraceFilter): Prisma.ObservabilityTraceWhereInput {
  return {
    ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.service ? { service: filter.service } : {}),
    ...(filter.from || filter.to
      ? {
          startedAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull;
}

function toSpanCreate(span: ObservabilitySpan): Prisma.ObservabilitySpanUncheckedCreateInput {
  const snapshot = span.toSnapshot();
  return {
    id: snapshot.id,
    traceId: snapshot.traceId,
    parentSpanId: snapshot.parentSpanId ?? null,
    name: snapshot.name,
    service: snapshot.service,
    kind: snapshot.kind,
    status: snapshot.status,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    durationMs: snapshot.durationMs,
    attributes: toJson(snapshot.attributes),
  };
}

function toLog(record: {
  id: string;
  occurredAt: Date;
  level: string;
  service: string;
  message: string;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  organizationId: string | null;
  actorId: string | null;
  method: string | null;
  path: string | null;
  route: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  attributes: Prisma.JsonValue;
}): ObservabilityLogRecord {
  return ObservabilityLogRecord.rehydrate({
    id: createObservabilityLogId(record.id),
    occurredAt: record.occurredAt,
    level: parseLogLevel(record.level),
    service: parseService(record.service),
    message: record.message,
    requestId: record.requestId ?? undefined,
    correlationId: record.correlationId ?? undefined,
    traceId: record.traceId ?? undefined,
    organizationId: record.organizationId ?? undefined,
    actorId: record.actorId ?? undefined,
    method: record.method ?? undefined,
    path: record.path ?? undefined,
    route: record.route ?? undefined,
    statusCode: record.statusCode ?? undefined,
    latencyMs: record.latencyMs ?? undefined,
    errorCode: record.errorCode ?? undefined,
    attributes: jsonRecord(record.attributes),
  });
}

function toTrace(record: {
  id: string;
  correlationId: string | null;
  organizationId: string | null;
  name: string;
  service: string;
  status: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  spanCount: number;
}): ObservabilityTrace {
  return ObservabilityTrace.rehydrate({
    id: createObservabilityTraceId(record.id),
    correlationId: record.correlationId ?? undefined,
    organizationId: record.organizationId ?? undefined,
    name: record.name,
    service: parseService(record.service),
    status: parseSpanStatus(record.status),
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationMs: record.durationMs,
    spanCount: record.spanCount,
  });
}

function toSpan(record: {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  service: string;
  kind: string;
  status: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  attributes: Prisma.JsonValue;
}): ObservabilitySpan {
  return ObservabilitySpan.rehydrate({
    id: createObservabilitySpanId(record.id),
    traceId: createObservabilityTraceId(record.traceId),
    parentSpanId: record.parentSpanId ? createObservabilitySpanId(record.parentSpanId) : undefined,
    name: record.name,
    service: parseService(record.service),
    kind: parseSpanKind(record.kind),
    status: parseSpanStatus(record.status),
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationMs: record.durationMs,
    attributes: jsonRecord(record.attributes),
  });
}

function toMetric(record: {
  id: string;
  name: string;
  labelsHash: string;
  labels: Prisma.JsonValue;
  bucketStart: Date;
  organizationId: string | null;
  count: number;
  sum: number;
  min: number;
  max: number;
}): ObservabilityMetricSample {
  return ObservabilityMetricSample.rehydrate({
    id: createObservabilityMetricBucketId(record.id),
    name: record.name,
    labelsHash: record.labelsHash,
    labels: stringRecord(record.labels),
    bucketStart: record.bucketStart,
    organizationId: record.organizationId ?? undefined,
    count: record.count,
    sum: record.sum,
    min: record.min,
    max: record.max,
  });
}

function toIncidentRecord(snapshot: ReturnType<ObservabilityIncident['toSnapshot']>): Prisma.ObservabilityIncidentUncheckedCreateInput {
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
    firstSeenAt: snapshot.firstSeenAt,
    lastSeenAt: snapshot.lastSeenAt,
    acknowledgedAt: snapshot.acknowledgedAt ?? null,
    acknowledgedBy: snapshot.acknowledgedBy ?? null,
    resolvedAt: snapshot.resolvedAt ?? null,
    resolvedBy: snapshot.resolvedBy ?? null,
  };
}

function toIncident(record: {
  id: string;
  fingerprint: string;
  title: string;
  message: string;
  source: string;
  severity: string;
  status: string;
  organizationId: string | null;
  errorCode: string | null;
  route: string | null;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}): ObservabilityIncident {
  return ObservabilityIncident.rehydrate({
    id: createObservabilityIncidentId(record.id),
    fingerprint: record.fingerprint,
    title: record.title,
    message: record.message,
    source: parseIncidentSource(record.source),
    severity: parseIncidentSeverity(record.severity),
    status: parseIncidentStatus(record.status),
    organizationId: record.organizationId ?? undefined,
    errorCode: record.errorCode ?? undefined,
    route: record.route ?? undefined,
    count: record.count,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    acknowledgedAt: record.acknowledgedAt ?? undefined,
    acknowledgedBy: record.acknowledgedBy ?? undefined,
    resolvedAt: record.resolvedAt ?? undefined,
    resolvedBy: record.resolvedBy ?? undefined,
  });
}

function toEvaluation(record: {
  id: string;
  occurredAt: Date;
  organizationId: string | null;
  correlationId: string | null;
  traceId: string | null;
  operation: string;
  model: string | null;
  verdict: string;
  score: number;
  reason: string | null;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  inputGuardrail: string | null;
  outputGuardrail: string | null;
  citationCount: number;
  errorCode: string | null;
  attributes: Prisma.JsonValue;
}): ObservabilityAiEvaluation {
  return ObservabilityAiEvaluation.rehydrate({
    id: createObservabilityAiEvaluationId(record.id),
    occurredAt: record.occurredAt,
    organizationId: record.organizationId ?? undefined,
    correlationId: record.correlationId ?? undefined,
    traceId: record.traceId ?? undefined,
    operation: record.operation,
    model: record.model ?? undefined,
    verdict: parseEvaluationVerdict(record.verdict),
    score: record.score,
    reason: record.reason ?? undefined,
    latencyMs: record.latencyMs,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    inputGuardrail: record.inputGuardrail ?? undefined,
    outputGuardrail: record.outputGuardrail ?? undefined,
    citationCount: record.citationCount,
    errorCode: record.errorCode ?? undefined,
    attributes: jsonRecord(record.attributes),
  });
}
