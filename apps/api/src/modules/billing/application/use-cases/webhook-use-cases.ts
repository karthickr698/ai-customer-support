import type { EventBus, Logger } from '@ai-customer-support/shared';
import type {
  BillingWebhookAcceptedResponse,
  RenewBillingSubscriptionsResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { BillingPolicy } from '../../domain/billing-policy.js';
import { parseSubscriptionStatus } from '../../domain/values.js';
import { BillingCheckoutCompletedEvent, InvoicePaidEvent, InvoicePaymentFailedEvent, SubscriptionCanceledEvent, SubscriptionUpdatedEvent } from '../../domain/events.js';
import { BillingPaymentMethod } from '../../domain/payment-method.js';
import { BillingProviderEvent } from '../../domain/provider-event.js';
import type { NormalizedProviderEvent } from '../../domain/provider-event.js';
import type {
  BillingCheckoutSessionRepository,
  BillingInvoiceRepository,
  BillingPaymentMethodRepository,
  BillingPlanRepository,
  BillingProviderEventRepository,
  BillingSubscriptionRepository,
  ClockPort,
  PaymentProviderPort,
  TenantAccessPort,
} from '../ports.js';
import type { RenewBillingSubscriptionsUseCase } from './renew-subscriptions-use-case.js';

export class HandleBillingWebhookUseCase {
  constructor(
    private readonly provider: PaymentProviderPort,
    private readonly events: BillingProviderEventRepository,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly checkouts: BillingCheckoutSessionRepository,
    private readonly invoices: BillingInvoiceRepository,
    private readonly paymentMethods: BillingPaymentMethodRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: {
    readonly rawBody: string;
    readonly signature?: string;
  }): Promise<BillingWebhookAcceptedResponse> {
    const normalized = this.provider.verifyWebhook(input.rawBody, input.signature);
    const now = this.clock.now();
    const stored = BillingProviderEvent.create({
      provider: normalized.provider,
      providerEventId: normalized.providerEventId,
      type: normalized.type,
      payload: normalized.payload,
      now,
    });
    const inserted = await this.events.tryInsert(stored);
    if (!inserted) {
      return { received: true, duplicate: true };
    }
    try {
      await this.apply(normalized, now);
      stored.markProcessed(now);
      await this.events.save(stored);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Webhook processing failed';
      stored.markFailed(message, now);
      await this.events.save(stored);
      this.logger.warn('Billing webhook processing failed', {
        provider: normalized.provider,
        type: normalized.type,
        message,
      });
      throw error;
    }
    return { received: true, duplicate: false };
  }

  private async apply(event: NormalizedProviderEvent, now: Date): Promise<void> {
    if (event.type === 'checkout.session.completed') {
      await this.onCheckoutCompleted(event, now);
      return;
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await this.onSubscriptionChanged(event, now);
      return;
    }
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed' || event.type === 'invoice.finalized') {
      await this.onInvoiceEvent(event, now);
    }
  }

  private async onCheckoutCompleted(event: NormalizedProviderEvent, now: Date): Promise<void> {
    if (!event.checkoutSessionId) {
      return;
    }
    const checkout = await this.checkouts.findByProviderSessionId(event.checkoutSessionId);
    if (!checkout) {
      this.logger.warn('Billing checkout webhook had no local session', {
        checkoutSessionId: event.checkoutSessionId,
      });
      return;
    }
    const plan = await this.plans.findById(checkout.planId);
    const subscription = await this.subscriptions.findByTenant(checkout.organizationId);
    if (!plan || !subscription) {
      return;
    }
    checkout.complete(now);
    subscription.changePlan(plan.id, plan.interval, now);
    subscription.activate(now, {
      customerId: event.customerId,
      subscriptionId: event.subscriptionId,
    });
    await this.checkouts.save(checkout);
    await this.subscriptions.save(subscription);
    if (event.paymentLastFour) {
      await this.paymentMethods.clearDefault(checkout.organizationId);
      await this.paymentMethods.save(
        BillingPaymentMethod.create({
          organizationId: checkout.organizationId,
          provider: event.provider,
          now,
          providerPaymentMethodId: event.subscriptionId,
          brand: event.paymentBrand,
          lastFour: event.paymentLastFour,
          isDefault: true,
        }),
      );
    }
    await this.eventBus.publish(
      new BillingCheckoutCompletedEvent(
        crypto.randomUUID(),
        now,
        checkout.organizationId,
        checkout.id,
        plan.slug,
      ),
    );
    await this.eventBus.publish(
      new SubscriptionUpdatedEvent(
        crypto.randomUUID(),
        now,
        checkout.organizationId,
        subscription.id,
        plan.slug,
        subscription.status,
      ),
    );
  }

  private async onSubscriptionChanged(event: NormalizedProviderEvent, now: Date): Promise<void> {
    if (!event.subscriptionId) {
      return;
    }
    const subscription = await this.subscriptions.findByProviderSubscriptionId(
      event.provider,
      event.subscriptionId,
    );
    if (!subscription) {
      return;
    }
    const plan = event.planSlug ? await this.plans.findBySlug(event.planSlug) : undefined;
    if (event.type === 'customer.subscription.deleted') {
      subscription.cancelImmediately(now);
      await this.subscriptions.save(subscription);
      await this.eventBus.publish(
        new SubscriptionCanceledEvent(
          crypto.randomUUID(),
          now,
          subscription.organizationId,
          subscription.id,
          true,
        ),
      );
      return;
    }
    if (plan && subscription.allowsUsage) {
      subscription.changePlan(plan.id, plan.interval, now);
    }
    if (event.status) {
      subscription.applyProviderStatus(mapProviderStatus(event.status), now);
    }
    await this.subscriptions.save(subscription);
    await this.eventBus.publish(
      new SubscriptionUpdatedEvent(
        crypto.randomUUID(),
        now,
        subscription.organizationId,
        subscription.id,
        (plan ?? (await this.plans.findById(subscription.planId)))?.slug ?? 'unknown',
        subscription.status,
      ),
    );
  }

  private async onInvoiceEvent(event: NormalizedProviderEvent, now: Date): Promise<void> {
    if (!event.invoiceId) {
      return;
    }
    const invoice = await this.invoices.findByProviderInvoiceId(event.invoiceId);
    if (!invoice) {
      return;
    }
    if (event.type === 'invoice.paid') {
      invoice.markPaid(now);
      await this.invoices.save(invoice);
      const subscription = await this.subscriptions.findById(invoice.organizationId, invoice.subscriptionId);
      if (subscription && (subscription.status === 'past_due' || subscription.status === 'unpaid')) {
        subscription.activate(now);
        await this.subscriptions.save(subscription);
      }
      await this.eventBus.publish(
        new InvoicePaidEvent(
          crypto.randomUUID(),
          now,
          invoice.organizationId,
          invoice.id,
          invoice.number,
          invoice.totalCents,
        ),
      );
      return;
    }
    if (event.type === 'invoice.payment_failed') {
      invoice.markUncollectible(now);
      await this.invoices.save(invoice);
      const subscription = await this.subscriptions.findById(invoice.organizationId, invoice.subscriptionId);
      if (subscription) {
        subscription.markPastDue(now);
        await this.subscriptions.save(subscription);
      }
      await this.eventBus.publish(
        new InvoicePaymentFailedEvent(
          crypto.randomUUID(),
          now,
          invoice.organizationId,
          invoice.id,
          invoice.number,
        ),
      );
    }
  }
}

export class DispatchBillingRenewalUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly renew: RenewBillingSubscriptionsUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<RenewBillingSubscriptionsResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    return this.renew.execute();
  }
}

function mapProviderStatus(status: string): ReturnType<typeof parseSubscriptionStatus> {
  if (status === 'incomplete_expired') {
    return 'incomplete';
  }
  return parseSubscriptionStatus(status);
}
