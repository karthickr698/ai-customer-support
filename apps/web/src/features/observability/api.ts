import type {
  ObservabilityAiEvaluationListResponse,
  ObservabilityIncidentListResponse,
  ObservabilityLogListResponse,
  ObservabilityMetricsResponse,
  ObservabilityOverviewResponse,
  ObservabilityTraceDetailResponse,
  ObservabilityTraceListResponse,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}/observability${suffix}`;
}

export const observabilityApi = {
  overview: (organizationId: string, params?: { from?: string; to?: string }) =>
    apiClient.get<ObservabilityOverviewResponse>(orgPath(organizationId, '/overview'), { params }),
  logs: (organizationId: string, params?: Record<string, string | number | undefined>) =>
    apiClient.get<ObservabilityLogListResponse>(orgPath(organizationId, '/logs'), { params }),
  traces: (organizationId: string, params?: Record<string, string | number | undefined>) =>
    apiClient.get<ObservabilityTraceListResponse>(orgPath(organizationId, '/traces'), { params }),
  trace: (organizationId: string, traceId: string) =>
    apiClient.get<ObservabilityTraceDetailResponse>(orgPath(organizationId, `/traces/${traceId}`)),
  metrics: (organizationId: string, params?: Record<string, string | undefined>) =>
    apiClient.get<ObservabilityMetricsResponse>(orgPath(organizationId, '/metrics'), { params }),
  incidents: (organizationId: string, params?: Record<string, string | number | undefined>) =>
    apiClient.get<ObservabilityIncidentListResponse>(orgPath(organizationId, '/failures'), { params }),
  acknowledgeIncident: (organizationId: string, incidentId: string) =>
    apiClient.post(orgPath(organizationId, `/failures/${incidentId}/acknowledge`)),
  resolveIncident: (organizationId: string, incidentId: string) =>
    apiClient.post(orgPath(organizationId, `/failures/${incidentId}/resolve`)),
  evaluations: (organizationId: string, params?: Record<string, string | number | undefined>) =>
    apiClient.get<ObservabilityAiEvaluationListResponse>(orgPath(organizationId, '/ai-evaluations'), { params }),
};

export function observabilityPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/observability`;
  return segment ? `${base}/${segment}` : base;
}
