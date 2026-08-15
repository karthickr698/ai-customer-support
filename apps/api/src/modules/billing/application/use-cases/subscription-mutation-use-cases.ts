import type { EventBus } from '@ai-customer-support/shared';
import type { BillingSubscriptionResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { BillingPolicy } from '../../domain/billing-policy.js';
import { BillingPlanNotFoundError, InvalidBillingError } from '../../domain/errors.js';
import { SubscriptionCanceledEvent, SubscriptionUpdatedEvent } from '../../domain/events.js';
import { normalizeSlug } from '../../domain/values.js';
import type { RequestSecurityContext } from '../dtos.js';
import { toSubscriptionDto } from '../dtos.js';
import type {
  BillingPlanRepository,
  BillingSubscriptionRepository,
  ClockPort,
  PaymentProviderPort,
  TenantAccessPort,
} from '../ports.js';
import { loadSubscription } from './subscription-query-use-cases.js';

export class ChangeBillingPlanUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly provider: PaymentProviderPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly planSlug: string;
    readonly security: RequestSecurityContext;
  }): Promise<BillingSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const { subscription, plan: current } = await loadSubscription(
      this.subscriptions,
      this.plans,
      actor.tenantId,
    );
    const next = await this.plans.findBySlug(normalizeSlug(input.planSlug));
    if (!next || !next.active) {
      throw new BillingPlanNotFoundError();
    }
    if (next.id === current.id) {
      throw new InvalidBillingError('Subscription is already on that plan');
    }
    const now = this.clock.now();
    subscription.changePlan(next.id, next.interval, now);
    if (subscription.providerSubscriptionId && next.isPaid) {
      await this.provider.updateSubscriptionPlan({
        providerSubscriptionId: subscription.providerSubscriptionId,
        planName: next.name,
        amountCents: next.amountCents,
        currency: next.currency,
        interval: next.interval,
      });
    }
    await this.subscriptions.save(subscription);
    await this.eventBus.publish(
      new SubscriptionUpdatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        subscription.id,
        next.slug,
        subscription.status,
        input.security.correlationId,
      ),
    );
    return { subscription: toSubscriptionDto(subscription, next) };
  }
}

export class CancelBillingSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly provider: PaymentProviderPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly immediately?: boolean;
    readonly security: RequestSecurityContext;
  }): Promise<BillingSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const now = this.clock.now();
    const immediately = input.immediately === true;
    if (immediately) {
      subscription.cancelImmediately(now);
    } else {
      subscription.scheduleCancel(now);
    }
    if (subscription.providerSubscriptionId) {
      await this.provider.cancelSubscription(subscription.providerSubscriptionId, immediately);
    }
    await this.subscriptions.save(subscription);
    await this.eventBus.publish(
      new SubscriptionCanceledEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        subscription.id,
        immediately,
        input.security.correlationId,
      ),
    );
    return { subscription: toSubscriptionDto(subscription, plan) };
  }
}

export class ResumeBillingSubscriptionUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly security: RequestSecurityContext;
  }): Promise<BillingSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const now = this.clock.now();
    subscription.resume(now);
    await this.subscriptions.save(subscription);
    await this.eventBus.publish(
      new SubscriptionUpdatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        subscription.id,
        plan.slug,
        subscription.status,
        input.security.correlationId,
      ),
    );
    return { subscription: toSubscriptionDto(subscription, plan) };
  }
}
