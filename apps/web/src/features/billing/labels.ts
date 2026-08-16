import type { BillingInvoiceStatus, BillingSubscriptionStatus, BillingUsageMetric } from '@ai-customer-support/contracts';

export function billingPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/billing`;
  return segment ? `${base}/${segment}` : base;
}

export function formatCents(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
      amountCents / 100,
    );
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

export const SUBSCRIPTION_LABELS: Record<BillingSubscriptionStatus, string> = {
  incomplete: 'Incomplete',
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
};

export const INVOICE_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  paid: 'Paid',
  void: 'Void',
  uncollectible: 'Uncollectible',
};

export const METRIC_LABELS: Record<BillingUsageMetric, string> = {
  conversations: 'Conversations',
  ai_replies: 'AI replies',
  seats: 'Seats',
  knowledge_documents: 'Knowledge documents',
  tickets: 'Tickets',
  messages: 'Messages',
};
