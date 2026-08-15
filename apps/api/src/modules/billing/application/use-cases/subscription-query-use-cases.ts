import type { EventBus } from '@ai-customer-support/shared';
import type { BillingSubscriptionResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { DEFAULT_PLAN_SLUG } from '../../domain/billing-policy.js';
import { BillingPolicy } from '../../domain/billing-policy.js';
import {
  BillingPlanNotFoundError,
  BillingSubscriptionNotFoundError,
} from '../../domain/errors.js';
import { SubscriptionCreatedEvent } from '../../domain/events.js';
import { BillingSubscription } from '../../domain/subscription.js';
import { toSubscriptionDto } from '../dtos.js';
import type {
  BillingPlanRepository,
  BillingSubscriptionRepository,
  ClockPort,
  PaymentProviderPort,
} from '../ports.js';

export class ProvisionOrganizationSubscriptionUseCase {
  constructor(
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly provider: PaymentProviderPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly correlationId?: string;
  }): Promise<BillingSubscriptionResponse | undefined> {
    const existing = await this.subscriptions.findByTenant(input.tenantId);
    if (existing) {
      return undefined;
    }
    const plan = await this.plans.findBySlug(DEFAULT_PLAN_SLUG);
    if (!plan || !plan.active) {
      throw new BillingPlanNotFoundError();
    }
    const now = this.clock.now();
    const subscription = BillingSubscription.create({
      organizationId: input.tenantId,
      planId: plan.id,
      interval: plan.interval,
      seats: plan.quotas.seats.included ?? 1,
      now,
      createdByUserId: input.actorId,
      provider: this.provider.name,
      trialDays: plan.trialDays,
      paid: !plan.isPaid,
    });
    try {
      await this.subscriptions.save(subscription);
    } catch (error: unknown) {
      const raced = await this.subscriptions.findByTenant(input.tenantId);
      if (raced) {
        return undefined;
      }
      throw error;
    }
    await this.eventBus.publish(
      new SubscriptionCreatedEvent(
        crypto.randomUUID(),
        now,
        input.tenantId,
        subscription.id,
        plan.slug,
        subscription.status,
        input.correlationId,
      ),
    );
    return { subscription: toSubscriptionDto(subscription, plan) };
  }
}

export class GetBillingSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: import('../ports.js').TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly provision: ProvisionOrganizationSubscriptionUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<BillingSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_READ);
    const existing = await this.subscriptions.findByTenant(actor.tenantId);
    if (!existing) {
      const created = await this.provision.execute({ tenantId: actor.tenantId, actorId: actor.actorId });
      if (created) {
        return created;
      }
    }
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    return { subscription: toSubscriptionDto(subscription, plan) };
  }
}

export async function loadSubscription(
  subscriptions: BillingSubscriptionRepository,
  plans: BillingPlanRepository,
  tenantId: string,
): Promise<{ subscription: BillingSubscription; plan: import('../../domain/billing-plan.js').BillingPlan }> {
  const subscription = await subscriptions.findByTenant(tenantId);
  if (!subscription || !subscription.belongsTo(tenantId)) {
    throw new BillingSubscriptionNotFoundError();
  }
  const plan = await plans.findById(subscription.planId);
  if (!plan) {
    throw new BillingPlanNotFoundError();
  }
  return { subscription, plan };
}
