import type { Page, PageRequest } from '@ai-customer-support/shared';
import type {
  BillingInvoiceStatus,
  BillingProviderName,
  BillingUsageMetric,
} from '@ai-customer-support/contracts';
import type { BillingPlan } from '../domain/billing-plan.js';
import type { BillingCheckoutSession } from '../domain/checkout-session.js';
import type { BillingInvoice } from '../domain/invoice.js';
import type { BillingPaymentMethod } from '../domain/payment-method.js';
import type { BillingProviderEvent, NormalizedProviderEvent } from '../domain/provider-event.js';
import type { BillingSubscription } from '../domain/subscription.js';
import type { BillingUsageRecord } from '../domain/usage-record.js';
import type {
  BillingCheckoutSessionId,
  BillingInvoiceId,
  BillingPlanId,
  BillingSubscriptionId,
} from '../domain/ids.js';

export type BillingActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<BillingActor>;
}

export interface ClockPort {
  now(): Date;
}

export type ProviderCustomerInput = {
  readonly tenantId: string;
  readonly email?: string;
  readonly name?: string;
};

export type ProviderCheckoutInput = {
  readonly tenantId: string;
  readonly planSlug: string;
  readonly planName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly interval: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly customerId?: string;
  readonly metadata: Record<string, string>;
};

export type ProviderCheckoutResult = {
  readonly sessionId: string;
  readonly url?: string;
  readonly customerId?: string;
};

export type ProviderSubscriptionUpdateInput = {
  readonly providerSubscriptionId: string;
  readonly planName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly interval: string;
};

export interface PaymentProviderPort {
  readonly name: BillingProviderName;
  createCustomer(input: ProviderCustomerInput): Promise<{ customerId: string }>;
  createCheckoutSession(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>;
  cancelSubscription(providerSubscriptionId: string, immediately: boolean): Promise<void>;
  updateSubscriptionPlan(input: ProviderSubscriptionUpdateInput): Promise<void>;
  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedProviderEvent;
}

export interface BillingPlanRepository {
  save(plan: BillingPlan): Promise<void>;
  findById(planId: BillingPlanId): Promise<BillingPlan | null>;
  findBySlug(slug: string): Promise<BillingPlan | null>;
  listPublic(): Promise<BillingPlan[]>;
  listAll(): Promise<BillingPlan[]>;
}

export interface BillingSubscriptionRepository {
  save(subscription: BillingSubscription): Promise<void>;
  findByTenant(tenantId: string): Promise<BillingSubscription | null>;
  findById(tenantId: string, subscriptionId: BillingSubscriptionId): Promise<BillingSubscription | null>;
  findByProviderSubscriptionId(
    provider: BillingProviderName,
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null>;
  listDueForRenewal(now: Date, limit: number): Promise<BillingSubscription[]>;
}

export interface BillingCheckoutSessionRepository {
  save(session: BillingCheckoutSession): Promise<void>;
  findById(tenantId: string, sessionId: BillingCheckoutSessionId): Promise<BillingCheckoutSession | null>;
  findByProviderSessionId(providerSessionId: string): Promise<BillingCheckoutSession | null>;
}

export type UsageTotals = Record<BillingUsageMetric, number>;

export interface BillingUsageRepository {
  save(record: BillingUsageRecord): Promise<void>;
  tryInsert(record: BillingUsageRecord): Promise<boolean>;
  sumByPeriod(
    tenantId: string,
    subscriptionId: BillingSubscriptionId,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<UsageTotals>;
}

export type BillingInvoiceListFilter = {
  readonly status?: BillingInvoiceStatus;
};

export interface BillingInvoiceRepository {
  save(invoice: BillingInvoice): Promise<void>;
  findById(tenantId: string, invoiceId: BillingInvoiceId): Promise<BillingInvoice | null>;
  findByPeriod(
    tenantId: string,
    subscriptionId: BillingSubscriptionId,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<BillingInvoice | null>;
  findByProviderInvoiceId(providerInvoiceId: string): Promise<BillingInvoice | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: BillingInvoiceListFilter,
  ): Promise<Page<BillingInvoice>>;
}

export interface BillingPaymentMethodRepository {
  save(method: BillingPaymentMethod): Promise<void>;
  listByTenant(tenantId: string): Promise<BillingPaymentMethod[]>;
  clearDefault(tenantId: string): Promise<void>;
}

export interface BillingProviderEventRepository {
  save(event: BillingProviderEvent): Promise<void>;
  tryInsert(event: BillingProviderEvent): Promise<boolean>;
  findByProviderEventId(providerEventId: string): Promise<BillingProviderEvent | null>;
}
