import { InvalidPlatformError } from './errors.js';
import { createFeatureFlagId, type FeatureFlagId } from './ids.js';
import { normalizeFlagKey, normalizeText } from './values.js';

export type FeatureFlagSnapshot = {
  readonly id: FeatureFlagId;
  readonly key: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly createdBy?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class FeatureFlag {
  private constructor(
    readonly id: FeatureFlagId,
    readonly key: string,
    private descriptionValue: string | undefined,
    private enabledValue: boolean,
    readonly createdBy: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly key: string;
    readonly now: Date;
    readonly description?: string;
    readonly enabled?: boolean;
    readonly createdBy?: string;
    readonly id?: FeatureFlagId;
  }): FeatureFlag {
    return new FeatureFlag(
      input.id ?? createFeatureFlagId(),
      normalizeFlagKey(input.key),
      normalizeDescription(input.description),
      input.enabled ?? true,
      input.createdBy,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: FeatureFlagSnapshot): FeatureFlag {
    return new FeatureFlag(
      snapshot.id,
      snapshot.key,
      snapshot.description,
      snapshot.enabled,
      snapshot.createdBy,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get description(): string | undefined {
    return this.descriptionValue;
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  update(
    input: {
      readonly description?: string | null;
      readonly enabled?: boolean;
    },
    now: Date,
  ): void {
    if (input.description !== undefined) {
      this.descriptionValue = input.description === null ? undefined : normalizeDescription(input.description);
    }
    if (input.enabled !== undefined) {
      this.enabledValue = input.enabled;
    }
    this.updatedAtValue = now;
  }

  toSnapshot(): FeatureFlagSnapshot {
    return {
      id: this.id,
      key: this.key,
      description: this.descriptionValue,
      enabled: this.enabledValue,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeDescription(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  if (value.length > 240) {
    throw new InvalidPlatformError('Description must be at most 240 characters');
  }
  return normalizeText(value, 'Description', 1, 240);
}
