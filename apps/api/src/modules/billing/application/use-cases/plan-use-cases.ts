import type { BillingPlanListResponse } from '@ai-customer-support/contracts';
import { BillingPlan } from '../../domain/billing-plan.js';
import { DEFAULT_PLAN_CATALOG } from '../../domain/catalog.js';
import { toPlanDto } from '../dtos.js';
import type { BillingPlanRepository, ClockPort } from '../ports.js';

export class SeedBillingPlansUseCase {
  constructor(
    private readonly plans: BillingPlanRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<number> {
    const existing = await this.plans.listAll();
    const known = new Set(existing.map((plan) => plan.slug));
    let created = 0;
    const now = this.clock.now();
    for (const definition of DEFAULT_PLAN_CATALOG) {
      if (known.has(definition.slug)) {
        continue;
      }
      await this.plans.save(
        BillingPlan.create({
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
          interval: definition.interval,
          currency: definition.currency,
          amountCents: definition.amountCents,
          trialDays: definition.trialDays,
          quotas: definition.quotas,
          features: definition.features,
          now,
        }),
      );
      created += 1;
    }
    return created;
  }
}

export class ListBillingPlansUseCase {
  constructor(private readonly plans: BillingPlanRepository) {}

  async execute(): Promise<BillingPlanListResponse> {
    const items = await this.plans.listPublic();
    return { items: items.filter((plan) => plan.active && plan.public).map(toPlanDto) };
  }
}
