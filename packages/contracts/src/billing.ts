/**
 * Cross-runtime DTOs for tenant-scoped subscription billing, usage metering,
 * quota enforcement, invoices, and payment-provider webhooks.
 */

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
] as const;
export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export const BILLING_USAGE_METRICS = [
  'conversations',
  'ai_replies',
  'seats',
  'knowledge_documents',
  'tickets',
  'messages',
] as const;
export type BillingUsageMetric = (typeof BILLING_USAGE_METRICS)[number];

export const BILLING_INVOICE_STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'] as const;
export type BillingInvoiceStatus = (typeof BILLING_INVOICE_STATUSES)[number];

export const BILLING_INVOICE_LINE_KINDS = ['plan', 'usage', 'credit', 'tax'] as const;
export type BillingInvoiceLineKind = (typeof BILLING_INVOICE_LINE_KINDS)[number];

export const BILLING_PROVIDERS = ['console', 'stripe'] as const;
export type BillingProviderName = (typeof BILLING_PROVIDERS)[number];

export const BILLING_CHECKOUT_STATUSES = ['pending', 'completed', 'expired'] as const;
export type BillingCheckoutStatus = (typeof BILLING_CHECKOUT_STATUSES)[number];

export const BILLING_WEBHOOK_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
  'customer.subscription.trial_will_end',
] as const;
export type BillingWebhookEventType = (typeof BILLING_WEBHOOK_EVENT_TYPES)[number];

export type BillingQuotaLimitDto = {
  readonly included: number | null;
  readonly overageCents: number;
};

export type BillingPlanQuotasDto = {
  readonly conversations: BillingQuotaLimitDto;
  readonly ai_replies: BillingQuotaLimitDto;
  readonly seats: BillingQuotaLimitDto;
  readonly knowledge_documents: BillingQuotaLimitDto;
  readonly tickets: BillingQuotaLimitDto;
  readonly messages: BillingQuotaLimitDto;
};

export type BillingPlanDto = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly interval: BillingInterval;
  readonly currency: string;
  readonly amountCents: number;
  readonly trialDays: number;
  readonly quotas: BillingPlanQuotasDto;
  readonly features: readonly string[];
  readonly public: boolean;
  readonly active: boolean;
};

export type BillingPlanListResponse = {
  readonly items: readonly BillingPlanDto[];
};

export type BillingPlanResponse = {
  readonly plan: BillingPlanDto;
};

export type BillingSubscriptionDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly planId: string;
  readonly planSlug: string;
  readonly planName: string;
  readonly status: BillingSubscriptionStatus;
  readonly interval: BillingInterval;
  readonly currency: string;
  readonly amountCents: number;
  readonly seats: number;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly trialEndsAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt: string | null;
  readonly provider: BillingProviderName;
  readonly providerCustomerId: string | null;
  readonly providerSubscriptionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type BillingSubscriptionResponse = {
  readonly subscription: BillingSubscriptionDto;
};

export type StartBillingCheckoutRequest = {
  readonly planSlug: string;
  readonly successUrl?: string;
  readonly cancelUrl?: string;
};

export type BillingCheckoutSessionDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly planId: string;
  readonly planSlug: string;
  readonly status: BillingCheckoutStatus;
  readonly provider: BillingProviderName;
  readonly url: string | null;
  readonly expiresAt: string;
};

export type BillingCheckoutResponse = {
  readonly checkout: BillingCheckoutSessionDto;
};

export type CompleteBillingCheckoutRequest = {
  readonly sessionId: string;
};

export type ChangeBillingPlanRequest = {
  readonly planSlug: string;
};

export type CancelBillingSubscriptionRequest = {
  readonly immediately?: boolean;
};

export type RecordBillingUsageRequest = {
  readonly metric: BillingUsageMetric;
  readonly quantity?: number;
  readonly idempotencyKey?: string;
  readonly enforceQuota?: boolean;
};

export type BillingUsageMetricDto = {
  readonly metric: BillingUsageMetric;
  readonly used: number;
  readonly included: number | null;
  readonly remaining: number | null;
  readonly overage: number;
  readonly unlimited: boolean;
};

export type BillingUsageResponse = {
  readonly subscriptionId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly items: readonly BillingUsageMetricDto[];
};

export type BillingQuotaCheckRequest = {
  readonly metric: BillingUsageMetric;
  readonly quantity?: number;
};

export type BillingQuotaCheckDto = {
  readonly metric: BillingUsageMetric;
  readonly allowed: boolean;
  readonly used: number;
  readonly included: number | null;
  readonly remaining: number | null;
  readonly requested: number;
  readonly unlimited: boolean;
  readonly subscriptionStatus: BillingSubscriptionStatus;
};

export type BillingQuotaCheckResponse = {
  readonly check: BillingQuotaCheckDto;
};

export type BillingInvoiceLineDto = {
  readonly id: string;
  readonly description: string;
  readonly kind: BillingInvoiceLineKind;
  readonly metric: BillingUsageMetric | null;
  readonly quantity: number;
  readonly unitAmountCents: number;
  readonly amountCents: number;
};

export type BillingInvoiceDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly subscriptionId: string;
  readonly number: string;
  readonly status: BillingInvoiceStatus;
  readonly currency: string;
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly amountPaidCents: number;
  readonly amountDueCents: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly dueAt: string;
  readonly paidAt: string | null;
  readonly voidedAt: string | null;
  readonly hostedUrl: string | null;
  readonly provider: BillingProviderName;
  readonly providerInvoiceId: string | null;
  readonly lines: readonly BillingInvoiceLineDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type BillingInvoiceResponse = {
  readonly invoice: BillingInvoiceDto;
};

export type BillingInvoiceListResponse = {
  readonly items: readonly BillingInvoiceDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type IssueBillingInvoiceRequest = {
  readonly periodStart?: string;
  readonly periodEnd?: string;
};

export type BillingPaymentMethodDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: BillingProviderName;
  readonly brand: string | null;
  readonly lastFour: string | null;
  readonly expMonth: number | null;
  readonly expYear: number | null;
  readonly isDefault: boolean;
  readonly createdAt: string;
};

export type BillingPaymentMethodListResponse = {
  readonly items: readonly BillingPaymentMethodDto[];
};

export type BillingWebhookAcceptedResponse = {
  readonly received: true;
  readonly duplicate: boolean;
};

export type RenewBillingSubscriptionsResponse = {
  readonly renewed: number;
  readonly invoiced: number;
  readonly canceled: number;
};
