import type { EventBus } from '@ai-customer-support/shared';
import type { BillingCheckoutResponse, BillingSubscriptionResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { BillingPolicy } from '../../domain/billing-policy.js';
import { BillingCheckoutSession } from '../../domain/checkout-session.js';
import {
  BillingCheckoutNotFoundError,
  BillingPlanNotFoundError,
  InvalidBillingError,
} from '../../domain/errors.js';
import { BillingCheckoutCompletedEvent, SubscriptionUpdatedEvent } from '../../domain/events.js';
import { BillingPaymentMethod } from '../../domain/payment-method.js';
import { createBillingCheckoutSessionId } from '../../domain/ids.js';
import { isUuid, normalizeSlug, normalizeUrl } from '../../domain/values.js';
import type { RequestSecurityContext } from '../dtos.js';
import { toCheckoutDto, toSubscriptionDto } from '../dtos.js';
import type {
  BillingCheckoutSessionRepository,
  BillingPaymentMethodRepository,
  BillingPlanRepository,
  BillingSubscriptionRepository,
  ClockPort,
  PaymentProviderPort,
  TenantAccessPort,
} from '../ports.js';
import { loadSubscription } from './subscription-query-use-cases.js';
import type { ProvisionOrganizationSubscriptionUseCase } from './subscription-query-use-cases.js';

export class StartBillingCheckoutUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly checkouts: BillingCheckoutSessionRepository,
    private readonly provider: PaymentProviderPort,
    private readonly clock: ClockPort,
    private readonly provision: ProvisionOrganizationSubscriptionUseCase,
    private readonly defaultSuccessUrl: string,
    private readonly defaultCancelUrl: string,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly planSlug: string;
    readonly successUrl?: string;
    readonly cancelUrl?: string;
    readonly security: RequestSecurityContext;
  }): Promise<BillingCheckoutResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const plan = await this.plans.findBySlug(normalizeSlug(input.planSlug));
    if (!plan || !plan.active || !plan.public) {
      throw new BillingPlanNotFoundError();
    }
    if (!plan.isPaid) {
      throw new InvalidBillingError('The free plan does not require checkout');
    }
    await this.provision.execute({ tenantId: actor.tenantId, actorId: actor.actorId });
    const { subscription } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const successUrl = normalizeUrl(
      input.successUrl ?? this.defaultSuccessUrl,
      'successUrl',
      this.allowLocalHttp,
    );
    const cancelUrl = normalizeUrl(
      input.cancelUrl ?? this.defaultCancelUrl,
      'cancelUrl',
      this.allowLocalHttp,
    );
    let customerId = subscription.providerCustomerId;
    if (!customerId) {
      const created = await this.provider.createCustomer({ tenantId: actor.tenantId });
      customerId = created.customerId;
      subscription.attachProvider({
        provider: this.provider.name,
        customerId,
        now: this.clock.now(),
      });
      await this.subscriptions.save(subscription);
    }
    const checkoutId = createBillingCheckoutSessionId();
    const providerSession = await this.provider.createCheckoutSession({
      tenantId: actor.tenantId,
      planSlug: plan.slug,
      planName: plan.name,
      amountCents: plan.amountCents,
      currency: plan.currency,
      interval: plan.interval,
      successUrl,
      cancelUrl,
      customerId,
      metadata: {
        organizationId: actor.tenantId,
        planSlug: plan.slug,
        checkoutSessionId: checkoutId,
      },
    });
    const session = BillingCheckoutSession.create({
      id: checkoutId,
      organizationId: actor.tenantId,
      subscriptionId: subscription.id,
      planId: plan.id,
      provider: this.provider.name,
      providerSessionId: providerSession.sessionId,
      url: providerSession.url,
      successUrl,
      cancelUrl,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    await this.checkouts.save(session);
    return { checkout: toCheckoutDto(session, plan.slug) };
  }
}

export class CompleteBillingCheckoutUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly checkouts: BillingCheckoutSessionRepository,
    private readonly paymentMethods: BillingPaymentMethodRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly sessionId: string;
    readonly security: RequestSecurityContext;
  }): Promise<BillingSubscriptionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    if (!isUuid(input.sessionId)) {
      throw new InvalidBillingError('sessionId must be a UUID');
    }
    const checkout = await this.checkouts.findById(
      actor.tenantId,
      createBillingCheckoutSessionId(input.sessionId),
    );
    if (!checkout || !checkout.belongsTo(actor.tenantId)) {
      throw new BillingCheckoutNotFoundError();
    }
    const plan = await this.plans.findById(checkout.planId);
    if (!plan) {
      throw new BillingPlanNotFoundError();
    }
    const { subscription } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const now = this.clock.now();
    checkout.complete(now);
    subscription.changePlan(plan.id, plan.interval, now);
    subscription.activate(now);
    await this.checkouts.save(checkout);
    await this.subscriptions.save(subscription);
    await this.paymentMethods.clearDefault(actor.tenantId);
    await this.paymentMethods.save(
      BillingPaymentMethod.create({
        organizationId: actor.tenantId,
        provider: checkout.provider,
        now,
        brand: checkout.provider,
        lastFour: '0000',
        isDefault: true,
      }),
    );
    await this.eventBus.publish(
      new BillingCheckoutCompletedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        checkout.id,
        plan.slug,
        input.security.correlationId,
      ),
    );
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
