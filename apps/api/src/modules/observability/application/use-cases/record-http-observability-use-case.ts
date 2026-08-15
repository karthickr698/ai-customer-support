import { createHash } from 'node:crypto';
import type { EventBus } from '@ai-customer-support/shared';
import { ObservabilityIncidentOpenedEvent } from '../../domain/events.js';
import { FailurePolicy } from '../../domain/failure-policy.js';
import { ObservabilityIncident } from '../../domain/failure-incident.js';
import { ObservabilityLogRecord } from '../../domain/log-record.js';
import { ObservabilityMetricSample } from '../../domain/metric-sample.js';
import { incidentFingerprint, routeTemplate } from '../../domain/route-template.js';
import { ObservabilitySpan } from '../../domain/span.js';
import { ObservabilityTrace } from '../../domain/trace.js';
import type {
  ClockPort,
  ErrorRateWindowPort,
  ObservabilityIncidentRepository,
  ObservabilityLogRepository,
  ObservabilityMetricRepository,
  ObservabilityTraceRepository,
} from '../ports.js';

export type RecordHttpObservabilityInput = {
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly organizationId?: string;
  readonly actorId?: string;
  readonly errorCode?: string;
};

export class RecordHttpObservabilityUseCase {
  constructor(
    private readonly logs: ObservabilityLogRepository,
    private readonly traces: ObservabilityTraceRepository,
    private readonly metrics: ObservabilityMetricRepository,
    private readonly incidents: ObservabilityIncidentRepository,
    private readonly errorRates: ErrorRateWindowPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly windowSeconds: number,
    private readonly errorRateThreshold: number,
    private readonly minSampleSize: number,
  ) {}

  async execute(input: RecordHttpObservabilityInput): Promise<void> {
    const route = routeTemplate(input.path);
    const latencyMs = Math.max(0, input.endedAt.getTime() - input.startedAt.getTime());
    const isError = input.statusCode >= 500;
    const level = isError ? 'error' : input.statusCode >= 400 ? 'warn' : 'info';

    await this.logs.save(
      ObservabilityLogRecord.create({
        occurredAt: input.endedAt,
        level,
        service: 'api',
        message: `${input.method} ${route} ${input.statusCode}`,
        requestId: input.requestId,
        correlationId: input.correlationId,
        traceId: input.traceId,
        organizationId: input.organizationId,
        actorId: input.actorId,
        method: input.method,
        path: input.path,
        route,
        statusCode: input.statusCode,
        latencyMs,
        errorCode: input.errorCode,
        attributes: {
          statusCode: input.statusCode,
        },
      }),
    );

    const status = isError ? 'error' : 'ok';
    await this.traces.save(
      ObservabilityTrace.create({
        id: input.traceId,
        correlationId: input.correlationId,
        organizationId: input.organizationId,
        name: `${input.method} ${route}`,
        service: 'api',
        status,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        spanCount: 1,
      }),
      [
        ObservabilitySpan.create({
          id: input.spanId,
          traceId: input.traceId,
          name: `${input.method} ${route}`,
          service: 'api',
          kind: 'server',
          status,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          attributes: {
            method: input.method,
            route,
            statusCode: input.statusCode,
          },
        }),
      ],
    );

    const labels = {
      method: input.method,
      route,
      status: String(input.statusCode),
      tenant: input.organizationId ?? 'platform',
    };
    await this.metrics.record(
      ObservabilityMetricSample.create({
        name: 'http.request.count',
        labelsHash: hashLabels(labels),
        labels,
        occurredAt: input.endedAt,
        organizationId: input.organizationId,
        value: 1,
      }),
    );
    await this.metrics.record(
      ObservabilityMetricSample.create({
        name: 'http.request.duration_ms',
        labelsHash: hashLabels({ method: input.method, route, tenant: input.organizationId ?? 'platform' }),
        labels: { method: input.method, route, tenant: input.organizationId ?? 'platform' },
        occurredAt: input.endedAt,
        organizationId: input.organizationId,
        value: latencyMs,
      }),
    );
    if (isError) {
      await this.metrics.record(
        ObservabilityMetricSample.create({
          name: 'http.request.errors',
          labelsHash: hashLabels({ method: input.method, route, tenant: input.organizationId ?? 'platform' }),
          labels: { method: input.method, route, tenant: input.organizationId ?? 'platform' },
          occurredAt: input.endedAt,
          organizationId: input.organizationId,
          value: 1,
        }),
      );
    }

    const window = await this.errorRates.increment({
      key: `http:${input.organizationId ?? 'platform'}:${route}`,
      isError,
      windowSeconds: this.windowSeconds,
    });
    if (
      isError &&
      FailurePolicy.shouldOpenFromErrorRate({
        window,
        threshold: this.errorRateThreshold,
        minSampleSize: this.minSampleSize,
      })
    ) {
      await this.openOrBumpIncident({
        source: 'http',
        title: `HTTP ${input.statusCode} on ${route}`,
        message: `${window.errors}/${window.total} requests failed in the last ${this.windowSeconds}s`,
        errorCode: input.errorCode ?? `HTTP_${input.statusCode}`,
        route,
        organizationId: input.organizationId,
        severity: FailurePolicy.severityForHttp(
          input.statusCode,
          window.total > 0 ? window.errors / window.total : 1,
        ),
        correlationId: input.correlationId,
      });
    }
  }

  private async openOrBumpIncident(input: {
    readonly source: 'http';
    readonly title: string;
    readonly message: string;
    readonly errorCode: string;
    readonly route: string;
    readonly organizationId?: string;
    readonly severity: ReturnType<typeof FailurePolicy.severityForHttp>;
    readonly correlationId: string;
  }): Promise<void> {
    const fingerprint = incidentFingerprint(input);
    const existing = await this.incidents.findOpenByFingerprint(fingerprint, input.organizationId);
    const now = this.clock.now();
    if (existing) {
      existing.recordOccurrence(now, input.severity);
      await this.incidents.save(existing);
      return;
    }
    const incident = ObservabilityIncident.open({
      fingerprint,
      title: input.title,
      message: input.message,
      source: input.source,
      severity: input.severity,
      organizationId: input.organizationId,
      errorCode: input.errorCode,
      route: input.route,
      now,
    });
    await this.incidents.save(incident);
    await this.eventBus.publish(
      new ObservabilityIncidentOpenedEvent(
        crypto.randomUUID(),
        now,
        incident.id,
        input.source,
        input.severity,
        input.organizationId,
        input.correlationId,
      ),
    );
  }
}

export function hashLabels(labels: Record<string, string>): string {
  const canonical = Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join('&');
  return createHash('sha256').update(canonical).digest('hex');
}
