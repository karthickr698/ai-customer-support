import type {
  BillingCheckoutResponse,
  BillingInvoiceListResponse,
  BillingInvoiceResponse,
  BillingPaymentMethodListResponse,
  BillingPlanListResponse,
  BillingQuotaCheckResponse,
  BillingSubscriptionResponse,
  BillingUsageResponse,
  CancelBillingSubscriptionRequest,
  ChangeBillingPlanRequest,
  CompleteBillingCheckoutRequest,
  StartBillingCheckoutRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}/billing${suffix}`;
}

export const billingApi = {
  listPlans: () => apiClient.get<BillingPlanListResponse>('/api/billing/plans'),
  subscription: (organizationId: string) =>
    apiClient.get<BillingSubscriptionResponse>(orgPath(organizationId, '/subscription')),
  startCheckout: (organizationId: string, body: StartBillingCheckoutRequest) =>
    apiClient.post<BillingCheckoutResponse>(orgPath(organizationId, '/checkout'), body),
  completeCheckout: (organizationId: string, body: CompleteBillingCheckoutRequest) =>
    apiClient.post<BillingSubscriptionResponse>(orgPath(organizationId, '/checkout/complete'), body),
  changePlan: (organizationId: string, body: ChangeBillingPlanRequest) =>
    apiClient.post<BillingSubscriptionResponse>(orgPath(organizationId, '/subscription/change-plan'), body),
  cancel: (organizationId: string, body: CancelBillingSubscriptionRequest = {}) =>
    apiClient.post<BillingSubscriptionResponse>(orgPath(organizationId, '/subscription/cancel'), body),
  resume: (organizationId: string) =>
    apiClient.post<BillingSubscriptionResponse>(orgPath(organizationId, '/subscription/resume')),
  usage: (organizationId: string) =>
    apiClient.get<BillingUsageResponse>(orgPath(organizationId, '/usage')),
  quotas: (organizationId: string) =>
    apiClient.get<BillingUsageResponse>(orgPath(organizationId, '/quotas')),
  checkQuota: (organizationId: string, metric: string, quantity = 1) =>
    apiClient.post<BillingQuotaCheckResponse>(orgPath(organizationId, '/quotas/check'), { metric, quantity }),
  invoices: (organizationId: string, params?: { page?: number; pageSize?: number; status?: string }) =>
    apiClient.get<BillingInvoiceListResponse>(orgPath(organizationId, '/invoices'), { params }),
  getInvoice: (organizationId: string, invoiceId: string) =>
    apiClient.get<BillingInvoiceResponse>(orgPath(organizationId, `/invoices/${invoiceId}`)),
  payInvoice: (organizationId: string, invoiceId: string) =>
    apiClient.post<BillingInvoiceResponse>(orgPath(organizationId, `/invoices/${invoiceId}/pay`)),
  paymentMethods: (organizationId: string) =>
    apiClient.get<BillingPaymentMethodListResponse>(orgPath(organizationId, '/payment-methods')),
};
