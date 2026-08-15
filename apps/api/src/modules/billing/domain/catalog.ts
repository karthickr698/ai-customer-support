import type { BillingPlanQuotasDto, BillingUsageMetric } from '@ai-customer-support/contracts';
import { BILLING_USAGE_METRICS } from '@ai-customer-support/contracts';
import { InvalidBillingError } from './errors.js';
import { DEFAULT_CURRENCY } from './billing-policy.js';

export type PlanQuotaLimit = {
  readonly included: number | null;
  readonly overageCents: number;
};

export type PlanQuotas = {
  readonly [K in BillingUsageMetric]: PlanQuotaLimit;
};

export type CatalogPlanDefinition = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly interval: 'month';
  readonly currency: string;
  readonly amountCents: number;
  readonly trialDays: number;
  readonly quotas: PlanQuotas;
  readonly features: readonly string[];
};

const unlimited = (overageCents = 0): PlanQuotaLimit => ({ included: null, overageCents });
const limit = (included: number, overageCents: number): PlanQuotaLimit => ({ included, overageCents });

export const DEFAULT_PLAN_CATALOG: readonly CatalogPlanDefinition[] = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Trial workspace with starter quotas for conversations, tickets, and AI replies.',
    interval: 'month',
    currency: DEFAULT_CURRENCY,
    amountCents: 0,
    trialDays: 14,
    quotas: {
      conversations: limit(50, 0),
      ai_replies: limit(200, 0),
      seats: limit(3, 0),
      knowledge_documents: limit(10, 0),
      tickets: limit(100, 0),
      messages: limit(1_000, 0),
    },
    features: ['Email support', 'Widget', 'Knowledge base'],
  },
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For small support teams that need usage-based overage and invoicing.',
    interval: 'month',
    currency: DEFAULT_CURRENCY,
    amountCents: 4_900,
    trialDays: 14,
    quotas: {
      conversations: limit(500, 10),
      ai_replies: limit(2_000, 5),
      seats: limit(10, 0),
      knowledge_documents: limit(100, 0),
      tickets: limit(1_000, 5),
      messages: limit(10_000, 1),
    },
    features: ['Priority email support', 'Usage metering', 'Invoices'],
  },
  {
    slug: 'growth',
    name: 'Growth',
    description: 'Higher quotas for growing support orgs with AI-assisted replies.',
    interval: 'month',
    currency: DEFAULT_CURRENCY,
    amountCents: 19_900,
    trialDays: 14,
    quotas: {
      conversations: limit(5_000, 8),
      ai_replies: limit(20_000, 4),
      seats: limit(50, 0),
      knowledge_documents: limit(1_000, 0),
      tickets: limit(10_000, 4),
      messages: limit(100_000, 1),
    },
    features: ['SLA reporting', 'SSO-ready', 'Overage billing'],
  },
  {
    slug: 'scale',
    name: 'Scale',
    description: 'Unlimited included usage with negotiated overage disabled.',
    interval: 'month',
    currency: DEFAULT_CURRENCY,
    amountCents: 49_900,
    trialDays: 14,
    quotas: {
      conversations: unlimited(),
      ai_replies: unlimited(),
      seats: unlimited(),
      knowledge_documents: unlimited(),
      tickets: unlimited(),
      messages: unlimited(),
    },
    features: ['Unlimited included usage', 'Dedicated success', 'Custom invoices'],
  },
];

export const USAGE_EVENT_METRICS: Readonly<Record<string, BillingUsageMetric>> = {
  ConversationCreated: 'conversations',
  TicketCreated: 'tickets',
  KnowledgeDocumentUploaded: 'knowledge_documents',
  InvitationAccepted: 'seats',
};

export const METERED_SOURCE_EVENTS = [
  ...Object.keys(USAGE_EVENT_METRICS),
  'MessageReceived',
] as const;

export function parsePlanQuotas(value: unknown): PlanQuotas {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const quotas = {} as Record<BillingUsageMetric, PlanQuotaLimit>;
  for (const metric of BILLING_USAGE_METRICS) {
    quotas[metric] = parseQuotaLimit(record[metric], metric);
  }
  return quotas as PlanQuotas;
}

export function toQuotaDto(quotas: PlanQuotas): BillingPlanQuotasDto {
  return quotas;
}

function parseQuotaLimit(value: unknown, metric: string): PlanQuotaLimit {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidBillingError(`Quota for ${metric} is required`);
  }
  const record = value as Record<string, unknown>;
  const included = record.included;
  const overageCents = record.overageCents;
  if (included !== null && (typeof included !== 'number' || !Number.isInteger(included) || included < 0)) {
    throw new InvalidBillingError(`Included quota for ${metric} must be a non-negative integer or null`);
  }
  if (typeof overageCents !== 'number' || !Number.isInteger(overageCents) || overageCents < 0) {
    throw new InvalidBillingError(`Overage for ${metric} must be a non-negative integer`);
  }
  return { included, overageCents };
}

export function remainingQuota(included: number | null, used: number): number | null {
  if (included === null) {
    return null;
  }
  return Math.max(0, included - used);
}

export function wouldExceedQuota(included: number | null, used: number, requested: number): boolean {
  if (included === null) {
    return false;
  }
  return used + requested > included;
}
