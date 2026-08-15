import type { ObservabilityService, ObservabilitySpanStatus } from '@ai-customer-support/contracts';
import { createObservabilityTraceId, type ObservabilityTraceId } from './ids.js';
import { parseService, parseSpanStatus } from './values.js';

export type ObservabilityTraceSnapshot = {
  readonly id: ObservabilityTraceId;
  readonly correlationId?: string;
  readonly organizationId?: string;
  readonly name: string;
  readonly service: ObservabilityService;
  readonly status: ObservabilitySpanStatus;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly durationMs: number;
  readonly spanCount: number;
};

export class ObservabilityTrace {
  private constructor(private snapshot: ObservabilityTraceSnapshot) {}

  static create(input: {
    readonly id?: string;
    readonly correlationId?: string;
    readonly organizationId?: string;
    readonly name: string;
    readonly service: ObservabilityService;
    readonly status: ObservabilitySpanStatus;
    readonly startedAt: Date;
    readonly endedAt: Date;
    readonly spanCount?: number;
  }): ObservabilityTrace {
    const durationMs = Math.max(0, input.endedAt.getTime() - input.startedAt.getTime());
    return new ObservabilityTrace({
      id: createObservabilityTraceId(input.id),
      correlationId: input.correlationId,
      organizationId: input.organizationId,
      name: input.name.trim() || 'request',
      service: parseService(input.service),
      status: parseSpanStatus(input.status),
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs,
      spanCount: input.spanCount ?? 1,
    });
  }

  static rehydrate(snapshot: ObservabilityTraceSnapshot): ObservabilityTrace {
    return new ObservabilityTrace({
      ...snapshot,
      id: createObservabilityTraceId(snapshot.id),
      service: parseService(snapshot.service),
      status: parseSpanStatus(snapshot.status),
    });
  }

  addSpan(status: ObservabilitySpanStatus, endedAt: Date): void {
    this.snapshot = {
      ...this.snapshot,
      spanCount: this.snapshot.spanCount + 1,
      status: this.snapshot.status === 'error' || status === 'error' ? 'error' : 'ok',
      endedAt: endedAt > this.snapshot.endedAt ? endedAt : this.snapshot.endedAt,
      durationMs: Math.max(
        this.snapshot.durationMs,
        Math.max(0, (endedAt > this.snapshot.endedAt ? endedAt : this.snapshot.endedAt).getTime() -
          this.snapshot.startedAt.getTime()),
      ),
    };
  }

  toSnapshot(): ObservabilityTraceSnapshot {
    return this.snapshot;
  }
}
