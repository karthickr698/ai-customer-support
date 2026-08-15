import type {
  BillingCheckoutSessionDto,
  BillingInvoiceDto,
  BillingInvoiceLineDto,
  BillingPaymentMethodDto,
  BillingPlanDto,
  BillingSubscriptionDto,
  BillingUsageMetric,
  BillingUsageMetricDto,
} from '@ai-customer-support/contracts';
import { BILLING_USAGE_METRICS } from '@ai-customer-support/contracts';
import type { BillingPlan } from '../domain/billing-plan.js';
import { remainingQuota, toQuotaDto, type PlanQuotas } from '../domain/catalog.js';
import type { BillingCheckoutSession } from '../domain/checkout-session.js';
import type { BillingInvoice } from '../domain/invoice.js';
import type { BillingPaymentMethod } from '../domain/payment-method.js';
import type { BillingSubscription } from '../domain/subscription.js';
import type { UsageTotals } from './ports.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function emptyUsageTotals(): UsageTotals {
  return {
    conversations: 0,
    ai_replies: 0,
    seats: 0,
    knowledge_documents: 0,
    tickets: 0,
    messages: 0,
  };
}

export function toPlanDto(plan: BillingPlan): BillingPlanDto {
  const snapshot = plan.toSnapshot();
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    name: snapshot.name,
    description: snapshot.description,
    interval: snapshot.interval,
    currency: snapshot.currency,
    amountCents: snapshot.amountCents,
    trialDays: snapshot.trialDays,
    quotas: toQuotaDto(snapshot.quotas),
    features: snapshot.features,
    public: snapshot.public,
    active: snapshot.active,
  };
}

export function toSubscriptionDto(subscription: BillingSubscription, plan: BillingPlan): BillingSubscriptionDto {
  const snapshot = subscription.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    planId: snapshot.planId,
    planSlug: plan.slug,
    planName: plan.name,
    status: snapshot.status,
    interval: snapshot.interval,
    currency: plan.currency,
    amountCents: plan.amountCents,
    seats: snapshot.seats,
    currentPeriodStart: snapshot.currentPeriodStart.toISOString(),
    currentPeriodEnd: snapshot.currentPeriodEnd.toISOString(),
    trialEndsAt: snapshot.trialEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.canceledAt?.toISOString() ?? null,
    provider: snapshot.provider,
    providerCustomerId: snapshot.providerCustomerId ?? null,
    providerSubscriptionId: snapshot.providerSubscriptionId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toCheckoutDto(session: BillingCheckoutSession, planSlug: string): BillingCheckoutSessionDto {
  const snapshot = session.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    planId: snapshot.planId,
    planSlug,
    status: snapshot.status,
    provider: snapshot.provider,
    url: snapshot.url ?? null,
    expiresAt: snapshot.expiresAt.toISOString(),
  };
}

export function toUsageItems(quotas: PlanQuotas, totals: UsageTotals): BillingUsageMetricDto[] {
  return BILLING_USAGE_METRICS.map((metric) => {
    const included = quotas[metric].included;
    const used = totals[metric] ?? 0;
    const remaining = remainingQuota(included, used);
    return {
      metric,
      used,
      included,
      remaining,
      overage: included === null ? 0 : Math.max(0, used - included),
      unlimited: included === null,
    };
  });
}

export function usedFor(totals: UsageTotals, metric: BillingUsageMetric): number {
  return totals[metric] ?? 0;
}

export function toInvoiceDto(invoice: BillingInvoice): BillingInvoiceDto {
  const snapshot = invoice.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subscriptionId: snapshot.subscriptionId,
    number: snapshot.number,
    status: snapshot.status,
    currency: snapshot.currency,
    subtotalCents: snapshot.subtotalCents,
    taxCents: snapshot.taxCents,
    totalCents: snapshot.totalCents,
    amountPaidCents: snapshot.amountPaidCents,
    amountDueCents: snapshot.amountDueCents,
    periodStart: snapshot.periodStart.toISOString(),
    periodEnd: snapshot.periodEnd.toISOString(),
    dueAt: snapshot.dueAt.toISOString(),
    paidAt: snapshot.paidAt?.toISOString() ?? null,
    voidedAt: snapshot.voidedAt?.toISOString() ?? null,
    hostedUrl: snapshot.hostedUrl ?? null,
    provider: snapshot.provider,
    providerInvoiceId: snapshot.providerInvoiceId ?? null,
    lines: snapshot.lines.map(
      (line): BillingInvoiceLineDto => ({
        id: line.id,
        description: line.description,
        kind: line.kind,
        metric: line.metric ?? null,
        quantity: line.quantity,
        unitAmountCents: line.unitAmountCents,
        amountCents: line.amountCents,
      }),
    ),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toPaymentMethodDto(method: BillingPaymentMethod): BillingPaymentMethodDto {
  const snapshot = method.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    provider: snapshot.provider,
    brand: snapshot.brand ?? null,
    lastFour: snapshot.lastFour ?? null,
    expMonth: snapshot.expMonth ?? null,
    expYear: snapshot.expYear ?? null,
    isDefault: snapshot.isDefault,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
