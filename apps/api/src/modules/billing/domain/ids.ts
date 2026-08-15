export type BillingPlanId = string & { readonly __brand: 'BillingPlanId' };
export type BillingSubscriptionId = string & { readonly __brand: 'BillingSubscriptionId' };
export type BillingCheckoutSessionId = string & { readonly __brand: 'BillingCheckoutSessionId' };
export type BillingUsageRecordId = string & { readonly __brand: 'BillingUsageRecordId' };
export type BillingInvoiceId = string & { readonly __brand: 'BillingInvoiceId' };
export type BillingInvoiceLineId = string & { readonly __brand: 'BillingInvoiceLineId' };
export type BillingPaymentMethodId = string & { readonly __brand: 'BillingPaymentMethodId' };
export type BillingProviderEventId = string & { readonly __brand: 'BillingProviderEventId' };

export function createBillingPlanId(id: string = crypto.randomUUID()): BillingPlanId {
  return id as BillingPlanId;
}

export function createBillingSubscriptionId(id: string = crypto.randomUUID()): BillingSubscriptionId {
  return id as BillingSubscriptionId;
}

export function createBillingCheckoutSessionId(
  id: string = crypto.randomUUID(),
): BillingCheckoutSessionId {
  return id as BillingCheckoutSessionId;
}

export function createBillingUsageRecordId(id: string = crypto.randomUUID()): BillingUsageRecordId {
  return id as BillingUsageRecordId;
}

export function createBillingInvoiceId(id: string = crypto.randomUUID()): BillingInvoiceId {
  return id as BillingInvoiceId;
}

export function createBillingInvoiceLineId(id: string = crypto.randomUUID()): BillingInvoiceLineId {
  return id as BillingInvoiceLineId;
}

export function createBillingPaymentMethodId(
  id: string = crypto.randomUUID(),
): BillingPaymentMethodId {
  return id as BillingPaymentMethodId;
}

export function createBillingProviderEventId(
  id: string = crypto.randomUUID(),
): BillingProviderEventId {
  return id as BillingProviderEventId;
}
