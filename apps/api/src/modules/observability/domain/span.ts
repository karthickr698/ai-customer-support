import type {
  ObservabilityService,
  ObservabilitySpanKind,
  ObservabilitySpanStatus,
} from '@ai-customer-support/contracts';
import { createObservabilitySpanId, type ObservabilitySpanId, type ObservabilityTraceId } from './ids.js';
import { parseService, parseSpanKind, parseSpanStatus, redactAttributes } from './values.js';

export type ObservabilitySpanSnapshot = {
  readonly id: ObservabilitySpanId;
  readonly traceId: ObservabilityTraceId;
  readonly parentSpanId?: ObservabilitySpanId;
  readonly name: string;
  readonly service: ObservabilityService;
  readonly kind: ObservabilitySpanKind;
  readonly status: ObservabilitySpanStatus;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly durationMs: number;
  readonly attributes?: Record<string, unknown>;
};

export class ObservabilitySpan {
  private constructor(private readonly snapshot: ObservabilitySpanSnapshot) {}

  static create(input: {
    readonly id?: string;
    readonly traceId: string;
    readonly parentSpanId?: string;
    readonly name: string;
    readonly service: ObservabilityService;
    readonly kind: ObservabilitySpanKind;
    readonly status: ObservabilitySpanStatus;
    readonly startedAt: Date;
    readonly endedAt: Date;
    readonly attributes?: Record<string, unknown>;
  }): ObservabilitySpan {
    return new ObservabilitySpan({
      id: createObservabilitySpanId(input.id),
      traceId: input.traceId as ObservabilityTraceId,
      parentSpanId: input.parentSpanId ? createObservabilitySpanId(input.parentSpanId) : undefined,
      name: input.name.trim() || 'span',
      service: parseService(input.service),
      kind: parseSpanKind(input.kind),
      status: parseSpanStatus(input.status),
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: Math.max(0, input.endedAt.getTime() - input.startedAt.getTime()),
      attributes: redactAttributes(input.attributes),
    });
  }

  static rehydrate(snapshot: ObservabilitySpanSnapshot): ObservabilitySpan {
    return new ObservabilitySpan({
      ...snapshot,
      id: createObservabilitySpanId(snapshot.id),
      service: parseService(snapshot.service),
      kind: parseSpanKind(snapshot.kind),
      status: parseSpanStatus(snapshot.status),
      attributes: redactAttributes(snapshot.attributes),
    });
  }

  toSnapshot(): ObservabilitySpanSnapshot {
    return this.snapshot;
  }
}
