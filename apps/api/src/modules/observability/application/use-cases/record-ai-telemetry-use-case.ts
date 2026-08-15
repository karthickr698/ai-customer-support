import type { EventBus } from '@ai-customer-support/shared';
import type { ObservabilityEvaluationVerdict } from '@ai-customer-support/contracts';
import { ObservabilityAiEvaluation } from '../../domain/ai-evaluation.js';
import { ObservabilityIncidentOpenedEvent } from '../../domain/events.js';
import { FailurePolicy } from '../../domain/failure-policy.js';
import { ObservabilityIncident } from '../../domain/failure-incident.js';
import { ObservabilityLogRecord } from '../../domain/log-record.js';
import { ObservabilityMetricSample } from '../../domain/metric-sample.js';
import { incidentFingerprint } from '../../domain/route-template.js';
import { ObservabilitySpan } from '../../domain/span.js';
import { createObservabilitySpanId, createObservabilityTraceId } from '../../domain/ids.js';
import type {
  ClockPort,
  ErrorRateWindowPort,
  ObservabilityAiEvaluationRepository,
  ObservabilityIncidentRepository,
  ObservabilityLogRepository,
  ObservabilityMetricRepository,
  ObservabilityTraceRepository,
} from '../ports.js';
import { hashLabels } from './record-http-observability-use-case.js';

export type RecordAiTelemetryInput = {
  readonly operation: string;
  readonly path: string;
  readonly tenantId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId?: string;
  readonly parentSpanId?: string;
  readonly latencyMs: number;
  readonly statusCode: number;
  readonly ok: boolean;
  readonly model?: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly evaluationVerdict?: ObservabilityEvaluationVerdict;
  readonly evaluationScore?: number;
  readonly evaluationReason?: string;
  readonly inputGuardrail?: string;
  readonly outputGuardrail?: string;
  readonly citationCount?: number;
  readonly errorCode?: string;
};

export class RecordAiTelemetryUseCase {
  constructor(
    private readonly logs: ObservabilityLogRepository,
    private readonly traces: ObservabilityTraceRepository,
    private readonly metrics: ObservabilityMetricRepository,
    private readonly evaluations: ObservabilityAiEvaluationRepository,
    private readonly incidents: ObservabilityIncidentRepository,
    private readonly errorRates: ErrorRateWindowPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly windowSeconds: number,
    private readonly aiFailureThreshold: number,
  ) {}

  async execute(input: RecordAiTelemetryInput): Promise<void> {
    const now = this.clock.now();
    const startedAt = new Date(now.getTime() - input.latencyMs);
    const isError = !input.ok || input.statusCode >= 500;
    const verdict = input.evaluationVerdict ?? (isError ? 'failed' : 'passed');
    const score = input.evaluationScore ?? (isError ? 0 : 1);
    const traceId = input.traceId ?? input.correlationId ?? input.requestId;
    const spanId = createObservabilitySpanId();

    await this.logs.save(
      ObservabilityLogRecord.create({
        occurredAt: now,
        level: isError ? 'error' : verdict === 'degraded' ? 'warn' : 'info',
        service: 'ai',
        message: `AI ${input.operation} ${input.statusCode}`,
        requestId: input.requestId,
        correlationId: input.correlationId,
        traceId,
        organizationId: input.tenantId,
        path: input.path,
        route: input.operation,
        statusCode: input.statusCode,
        latencyMs: input.latencyMs,
        errorCode: input.errorCode,
        attributes: {
          model: input.model,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          verdict,
        },
      }),
    );

    const span = ObservabilitySpan.create({
      id: spanId,
      traceId,
      parentSpanId: input.parentSpanId,
      name: input.operation,
      service: 'ai',
      kind: 'client',
      status: isError ? 'error' : 'ok',
      startedAt,
      endedAt: now,
      attributes: {
        path: input.path,
        model: input.model,
        statusCode: input.statusCode,
      },
    });
    try {
      await this.traces.addSpan(createObservabilityTraceId(traceId), span, now);
    } catch {
      // Parent HTTP trace may not exist for async jobs; skip attaching the span.
    }

    const labels = { operation: input.operation, tenant: input.tenantId };
    await this.metrics.record(
      ObservabilityMetricSample.create({
        name: 'ai.request.count',
        labelsHash: hashLabels(labels),
        labels,
        occurredAt: now,
        organizationId: input.tenantId,
        value: 1,
      }),
    );
    await this.metrics.record(
      ObservabilityMetricSample.create({
        name: 'ai.request.duration_ms',
        labelsHash: hashLabels(labels),
        labels,
        occurredAt: now,
        organizationId: input.tenantId,
        value: input.latencyMs,
      }),
    );
    if ((input.promptTokens ?? 0) > 0) {
      await this.metrics.record(
        ObservabilityMetricSample.create({
          name: 'ai.tokens.prompt',
          labelsHash: hashLabels(labels),
          labels,
          occurredAt: now,
          organizationId: input.tenantId,
          value: input.promptTokens ?? 0,
        }),
      );
    }
    if ((input.completionTokens ?? 0) > 0) {
      await this.metrics.record(
        ObservabilityMetricSample.create({
          name: 'ai.tokens.completion',
          labelsHash: hashLabels(labels),
          labels,
          occurredAt: now,
          organizationId: input.tenantId,
          value: input.completionTokens ?? 0,
        }),
      );
    }
    if (isError) {
      await this.metrics.record(
        ObservabilityMetricSample.create({
          name: 'ai.request.errors',
          labelsHash: hashLabels(labels),
          labels,
          occurredAt: now,
          organizationId: input.tenantId,
          value: 1,
        }),
      );
    }
    if (verdict === 'failed') {
      await this.metrics.record(
        ObservabilityMetricSample.create({
          name: 'ai.evaluation.failed',
          labelsHash: hashLabels(labels),
          labels,
          occurredAt: now,
          organizationId: input.tenantId,
          value: 1,
        }),
      );
    }

    await this.evaluations.save(
      ObservabilityAiEvaluation.create({
        occurredAt: now,
        organizationId: input.tenantId,
        correlationId: input.correlationId,
        traceId,
        operation: input.operation,
        model: input.model,
        verdict,
        score,
        reason: input.evaluationReason,
        latencyMs: input.latencyMs,
        promptTokens: input.promptTokens ?? 0,
        completionTokens: input.completionTokens ?? 0,
        inputGuardrail: input.inputGuardrail,
        outputGuardrail: input.outputGuardrail,
        citationCount: input.citationCount ?? 0,
        errorCode: input.errorCode,
      }),
    );

    const failureKey = `ai:${input.tenantId}:${input.operation}`;
    if (isError) {
      const failures = await this.errorRates.incrementFailures(failureKey, this.windowSeconds);
      if (FailurePolicy.shouldOpenFromConsecutiveFailures(failures, this.aiFailureThreshold)) {
        await this.openOrBump({
          source: 'ai',
          title: `AI ${input.operation} failing`,
          message: `${failures} consecutive AI failures for ${input.operation}`,
          errorCode: input.errorCode ?? 'AI_PROVIDER_ERROR',
          route: input.operation,
          organizationId: input.tenantId,
          severity: FailurePolicy.severityForAi(failures),
          correlationId: input.correlationId,
        });
      }
    } else {
      await this.errorRates.resetFailures(failureKey);
    }

    if (verdict === 'failed' && isError) {
      await this.openOrBump({
        source: 'evaluation',
        title: `AI evaluation failed for ${input.operation}`,
        message: input.evaluationReason ?? 'Evaluation verdict failed',
        errorCode: input.errorCode ?? 'EVAL_FAILED',
        route: input.operation,
        organizationId: input.tenantId,
        severity: FailurePolicy.severityForEvaluation('failed'),
        correlationId: input.correlationId,
      });
    }
  }

  private async openOrBump(input: {
    readonly source: 'ai' | 'evaluation';
    readonly title: string;
    readonly message: string;
    readonly errorCode: string;
    readonly route: string;
    readonly organizationId: string;
    readonly severity: ReturnType<typeof FailurePolicy.severityForAi>;
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
