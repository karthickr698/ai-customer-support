import { createObservabilityMetricBucketId, type ObservabilityMetricBucketId } from './ids.js';
import { minuteBucket } from './values.js';

export type ObservabilityMetricBucketSnapshot = {
  readonly id: ObservabilityMetricBucketId;
  readonly name: string;
  readonly labelsHash: string;
  readonly labels: Record<string, string>;
  readonly bucketStart: Date;
  readonly organizationId?: string;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
};

export class ObservabilityMetricSample {
  private constructor(private readonly snapshot: ObservabilityMetricBucketSnapshot) {}

  static create(input: {
    readonly id?: string;
    readonly name: string;
    readonly labelsHash: string;
    readonly labels: Record<string, string>;
    readonly occurredAt: Date;
    readonly organizationId?: string;
    readonly value: number;
  }): ObservabilityMetricSample {
    const value = Number.isFinite(input.value) ? input.value : 0;
    return new ObservabilityMetricSample({
      id: createObservabilityMetricBucketId(input.id),
      name: input.name,
      labelsHash: input.labelsHash,
      labels: input.labels,
      bucketStart: minuteBucket(input.occurredAt),
      organizationId: input.organizationId,
      count: 1,
      sum: value,
      min: value,
      max: value,
    });
  }

  static rehydrate(snapshot: ObservabilityMetricBucketSnapshot): ObservabilityMetricSample {
    return new ObservabilityMetricSample({
      ...snapshot,
      id: createObservabilityMetricBucketId(snapshot.id),
    });
  }

  toSnapshot(): ObservabilityMetricBucketSnapshot {
    return this.snapshot;
  }
}
