import type {
  BillingPlanListResponse,
  ObservabilityIncidentListResponse,
  ObservabilityOverviewResponse,
  PlatformAuditLogListResponse,
  PlatformFeatureFlagEvaluationResponse,
  PlatformFeatureFlagListResponse,
  PlatformHealthResponse,
  PlatformMeResponse,
  PlatformOperatorListResponse,
  PlatformOperatorResponse,
  PlatformRole,
  PlatformTenantListResponse,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

export const platformApi = {
  me: () => apiClient.get<PlatformMeResponse>('/api/platform/me'),
  bootstrap: () => apiClient.post<PlatformOperatorResponse>('/api/platform/bootstrap'),
  operators: () => apiClient.get<PlatformOperatorListResponse>('/api/platform/operators'),
  grantOperator: (email: string, role: PlatformRole) =>
    apiClient.post<PlatformOperatorResponse>('/api/platform/operators', { email, role }),
  changeOperatorRole: (userId: string, role: PlatformRole) =>
    apiClient.patch<PlatformOperatorResponse>(`/api/platform/operators/${userId}`, { role }),
  revokeOperator: (userId: string) => apiClient.delete(`/api/platform/operators/${userId}`),
  tenants: (params?: { page?: number; pageSize?: number; q?: string; status?: string }) =>
    apiClient.get<PlatformTenantListResponse>('/api/platform/tenants', { params }),
  suspendTenant: (organizationId: string) =>
    apiClient.post(`/api/platform/tenants/${organizationId}/suspend`),
  activateTenant: (organizationId: string) =>
    apiClient.post(`/api/platform/tenants/${organizationId}/activate`),
  flags: () => apiClient.get<PlatformFeatureFlagListResponse>('/api/platform/feature-flags'),
  updateFlag: (key: string, enabled: boolean) =>
    apiClient.put(`/api/platform/feature-flags/${key}`, { enabled }),
  evaluateFlag: (key: string, organizationId?: string) =>
    apiClient.get<PlatformFeatureFlagEvaluationResponse>(`/api/platform/feature-flags/${key}/evaluation`, {
      params: { organizationId },
    }),
  health: () =>
    apiClient.get<PlatformHealthResponse>('/api/platform/health', {
      validateStatus: (status) => status === 200 || status === 503,
    }),
  audit: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<PlatformAuditLogListResponse>('/api/platform/audit-logs', { params }),
  incidents: (params?: { page?: number; pageSize?: number; status?: string }) =>
    apiClient.get<ObservabilityIncidentListResponse>('/api/observability/failures', { params }),
  acknowledgeIncident: (incidentId: string) =>
    apiClient.post(`/api/observability/failures/${incidentId}/acknowledge`),
  resolveIncident: (incidentId: string) =>
    apiClient.post(`/api/observability/failures/${incidentId}/resolve`),
  observabilityOverview: () => apiClient.get<ObservabilityOverviewResponse>('/api/observability/overview'),
  plans: () => apiClient.get<BillingPlanListResponse>('/api/billing/plans'),
};
