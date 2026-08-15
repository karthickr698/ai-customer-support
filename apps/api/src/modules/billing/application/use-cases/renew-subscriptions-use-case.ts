import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { RenewBillingSubscriptionsResponse } from '@ai-customer-support/contracts';
import { RENEWAL_BATCH_SIZE } from '../../domain/billing-policy.js';
import { DuplicateBillingInvoiceError } from '../../domain/errors.js';
import { SubscriptionCanceledEvent, SubscriptionUpdatedEvent } from '../../domain/events.js';
import type {
  BillingInvoiceRepository,
  BillingPlanRepository,
  BillingSubscriptionRepository,
  BillingUsageRepository,
  ClockPort,
} from '../ports.js';
import { issueInvoiceForPeriod } from './invoice-use-cases.js';

export class RenewBillingSubscriptionsUseCase {
  constructor(
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly usage: BillingUsageRepository,
    private readonly invoices: BillingInvoiceRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<RenewBillingSubscriptionsResponse> {
    const now = this.clock.now();
    const due = await this.subscriptions.listDueForRenewal(now, RENEWAL_BATCH_SIZE);
    let renewed = 0;
    let invoiced = 0;
    let canceled = 0;
    for (const subscription of due) {
      const plan = await this.plans.findById(subscription.planId);
      if (!plan) {
        this.logger.warn('Billing renewal skipped; plan missing', {
          tenantId: subscription.organizationId,
          subscriptionId: subscription.id,
        });
        continue;
      }
      const previousStart = subscription.currentPeriodStart;
      const previousEnd = subscription.currentPeriodEnd;
      try {
        await issueInvoiceForPeriod({
          invoices: this.invoices,
          usage: this.usage,
          clock: this.clock,
          eventBus: this.eventBus,
          tenantId: subscription.organizationId,
          subscription,
          planName: plan.name,
          amountCents: plan.amountCents,
          currency: plan.currency,
          quotas: plan.quotas,
          provider: subscription.provider,
          periodStart: previousStart,
          periodEnd: previousEnd,
        });
        invoiced += 1;
      } catch (error: unknown) {
        if (!(error instanceof DuplicateBillingInvoiceError)) {
          throw error;
        }
      }
      const wasCanceling = subscription.cancelAtPeriodEnd;
      subscription.renewPeriod(now);
      await this.subscriptions.save(subscription);
      if (subscription.status === 'canceled') {
        canceled += 1;
        await this.eventBus.publish(
          new SubscriptionCanceledEvent(
            crypto.randomUUID(),
            now,
            subscription.organizationId,
            subscription.id,
            true,
          ),
        );
      } else {
        renewed += 1;
        await this.eventBus.publish(
          new SubscriptionUpdatedEvent(
            crypto.randomUUID(),
            now,
            subscription.organizationId,
            subscription.id,
            plan.slug,
            subscription.status,
          ),
        );
      }
      void wasCanceling;
    }
    return { renewed, invoiced, canceled };
  }
}
