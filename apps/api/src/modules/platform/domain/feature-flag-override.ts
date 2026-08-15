import { InvalidPlatformError } from './errors.js';
import type { FeatureFlagSnapshot } from './feature-flag.js';
import {
  createFeatureFlagOverrideId,
  type FeatureFlagId,
  type FeatureFlagOverrideId,
} from './ids.js';
import { requireUuid } from './values.js';

export type FeatureFlagOverrideSnapshot = {
  readonly id: FeatureFlagOverrideId;
  readonly flagId: FeatureFlagId;
  readonly organizationId: string;
  readonly enabled: boolean;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class FeatureFlagOverride {
  private constructor(
    readonly id: FeatureFlagOverrideId,
    readonly flagId: FeatureFlagId,
    readonly organizationId: string,
    private enabledValue: boolean,
    readonly createdBy: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly flagId: FeatureFlagId;
    readonly organizationId: string;
    readonly enabled: boolean;
    readonly createdBy: string;
    readonly now: Date;
    readonly id?: FeatureFlagOverrideId;
  }): FeatureFlagOverride {
    if (!input.flagId) {
      throw new InvalidPlatformError('Feature flag is required');
    }
    return new FeatureFlagOverride(
      input.id ?? createFeatureFlagOverrideId(),
      input.flagId,
      requireUuid(input.organizationId, 'organizationId'),
      input.enabled,
      requireUuid(input.createdBy, 'createdBy'),
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: FeatureFlagOverrideSnapshot): FeatureFlagOverride {
    return new FeatureFlagOverride(
      snapshot.id,
      snapshot.flagId,
      snapshot.organizationId,
      snapshot.enabled,
      snapshot.createdBy,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  setEnabled(enabled: boolean, now: Date): void {
    this.enabledValue = enabled;
    this.updatedAtValue = now;
  }

  toSnapshot(): FeatureFlagOverrideSnapshot {
    return {
      id: this.id,
      flagId: this.flagId,
      organizationId: this.organizationId,
      enabled: this.enabledValue,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export type FeatureFlagEvaluation = {
  readonly key: string;
  readonly enabled: boolean;
  readonly source: 'global' | 'tenant_override';
  readonly organizationId?: string;
};

export function evaluateFeatureFlag(
  flag: FeatureFlagSnapshot,
  override: FeatureFlagOverrideSnapshot | undefined,
  organizationId?: string,
): FeatureFlagEvaluation {
  if (override && organizationId && override.organizationId === organizationId) {
    return {
      key: flag.key,
      enabled: override.enabled,
      source: 'tenant_override',
      organizationId,
    };
  }
  return {
    key: flag.key,
    enabled: flag.enabled,
    source: 'global',
    organizationId,
  };
}
