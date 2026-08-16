import type {
  OrganizationApiKeyCreatedResponse,
  OrganizationApiKeyListResponse,
  PublicApiSessionResponse,
  PublicApiUsageListResponse,
  PublicApiUsageSummaryResponse,
  PublicApiVersionResponse,
  VerifyWebhookSignatureResponse,
  WebhookDeliveryAttemptListResponse,
  WebhookDeliveryListResponse,
  WebhookEventName,
  WebhookSubscriptionCreatedResponse,
  WebhookSubscriptionListResponse,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export const developerApi = {
  version: () => apiClient.get<PublicApiVersionResponse>('/api/v1'),
  session: (organizationId: string) =>
    apiClient.get<PublicApiSessionResponse>(`/api/v1/organizations/${organizationId}`),
  apiKeys: (organizationId: string) =>
    apiClient.get<OrganizationApiKeyListResponse>(orgPath(organizationId, '/api-keys')),
  createApiKey: (organizationId: string, name: string, scopes?: readonly string[]) =>
    apiClient.post<OrganizationApiKeyCreatedResponse>(orgPath(organizationId, '/api-keys'), { name, scopes }),
  revokeApiKey: (organizationId: string, apiKeyId: string) =>
    apiClient.delete(orgPath(organizationId, `/api-keys/${apiKeyId}`)),
  webhooks: (organizationId: string) =>
    apiClient.get<WebhookSubscriptionListResponse>(orgPath(organizationId, '/webhooks')),
  createWebhook: (organizationId: string, url: string, events: readonly WebhookEventName[], description?: string) =>
    apiClient.post<WebhookSubscriptionCreatedResponse>(orgPath(organizationId, '/webhooks'), {
      url,
      events,
      description,
    }),
  deleteWebhook: (organizationId: string, webhookId: string) =>
    apiClient.delete(orgPath(organizationId, `/webhooks/${webhookId}`)),
  deliveries: (organizationId: string, webhookId: string, page = 1) =>
    apiClient.get<WebhookDeliveryListResponse>(orgPath(organizationId, `/webhooks/${webhookId}/deliveries`), {
      params: { page, pageSize: 20 },
    }),
  attempts: (organizationId: string, webhookId: string, deliveryId: string) =>
    apiClient.get<WebhookDeliveryAttemptListResponse>(
      orgPath(organizationId, `/webhooks/${webhookId}/deliveries/${deliveryId}/attempts`),
    ),
  retryDelivery: (organizationId: string, webhookId: string, deliveryId: string) =>
    apiClient.post(orgPath(organizationId, `/webhooks/${webhookId}/deliveries/${deliveryId}/retry`)),
  verifySignature: (organizationId: string, webhookId: string, signatureHeader: string, body: string) =>
    apiClient.post<VerifyWebhookSignatureResponse>(
      orgPath(organizationId, `/webhooks/${webhookId}/verify-signature`),
      { signatureHeader, body },
    ),
  usageSummary: (organizationId: string) =>
    apiClient.get<PublicApiUsageSummaryResponse>(orgPath(organizationId, '/api-usage')),
  usageRequests: (organizationId: string, page = 1) =>
    apiClient.get<PublicApiUsageListResponse>(orgPath(organizationId, '/api-usage/requests'), {
      params: { page, pageSize: 20 },
    }),
};
