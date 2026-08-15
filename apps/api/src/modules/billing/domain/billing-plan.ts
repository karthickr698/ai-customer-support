import type { BillingInterval } from '@ai-customer-support/contracts';
import { MAX_FEATURE_LENGTH, MAX_FEATURES } from './billing-policy.js';
import { parsePlanQuotas, type PlanQuotas } from './catalog.js';
import { InvalidBillingError } from './errors.js';
import { createBillingPlanId, type BillingPlanId } from './ids.js';
import {
  normalizeCurrency,
  normalizeSlug,
  normalizeText,
  parseInterval,
  requirePositiveInt,
} from './values.js';

export type BillingPlanSnapshot = {
  readonly id: BillingPlanId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly interval: BillingInterval;
  readonly currency: string;
  readonly amountCents: number;
  readonly trialDays: number;
  readonly quotas: PlanQuotas;
  readonly features: readonly string[];
  readonly public: boolean;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class BillingPlan {
  private constructor(
    readonly id: BillingPlanId,
    readonly slug: string,
    readonly name: string,
    readonly description: string,
    readonly interval: BillingInterval,
    readonly currency: string,
    readonly amountCents: number,
    readonly trialDays: number,
    readonly quotas: PlanQuotas,
    readonly features: readonly string[],
    private publicValue: boolean,
    private activeValue: boolean,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly interval: string;
    readonly currency: string;
    readonly amountCents: number;
    readonly trialDays: number;
    readonly quotas: unknown;
    readonly features: readonly string[];
    readonly now: Date;
    readonly public?: boolean;
    readonly active?: boolean;
    readonly id?: BillingPlanId;
  }): BillingPlan {
    return new BillingPlan(
      input.id ?? createBillingPlanId(),
      normalizeSlug(input.slug),
      normalizeText(input.name, 'Name', 1, 80),
      normalizeText(input.description, 'Description', 1, 400),
      parseInterval(input.interval),
      normalizeCurrency(input.currency),
      requirePositiveInt(input.amountCents, 'amountCents'),
      requirePositiveInt(input.trialDays, 'trialDays', 365),
      parsePlanQuotas(input.quotas),
      parseFeatures(input.features),
      input.public ?? true,
      input.active ?? true,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingPlanSnapshot): BillingPlan {
    return new BillingPlan(
      snapshot.id,
      snapshot.slug,
      snapshot.name,
      snapshot.description,
      snapshot.interval,
      snapshot.currency,
      snapshot.amountCents,
      snapshot.trialDays,
      snapshot.quotas,
      snapshot.features,
      snapshot.public,
      snapshot.active,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get public(): boolean {
    return this.publicValue;
  }

  get active(): boolean {
    return this.activeValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isPaid(): boolean {
    return this.amountCents > 0;
  }

  deactivate(now: Date): void {
    this.activeValue = false;
    this.updatedAtValue = now;
  }

  toSnapshot(): BillingPlanSnapshot {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      description: this.description,
      interval: this.interval,
      currency: this.currency,
      amountCents: this.amountCents,
      trialDays: this.trialDays,
      quotas: this.quotas,
      features: this.features,
      public: this.publicValue,
      active: this.activeValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function parseFeatures(features: readonly string[]): readonly string[] {
  if (features.length > MAX_FEATURES) {
    throw new InvalidBillingError(`At most ${MAX_FEATURES} features are allowed`);
  }
  return features.map((feature) => normalizeText(feature, 'Feature', 1, MAX_FEATURE_LENGTH));
}
