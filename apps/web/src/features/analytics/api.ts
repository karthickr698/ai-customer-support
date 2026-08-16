import type {
  AgentAnalyticsResponse,
  AnalyticsGranularity,
  AnalyticsOverviewResponse,
  AnalyticsTimeSeriesResponse,
  ConversationAnalyticsResponse,
  CustomerAnalyticsResponse,
  TicketAnalyticsResponse,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

export type AnalyticsPeriodParams = {
  readonly from?: string;
  readonly to?: string;
  readonly granularity?: AnalyticsGranularity;
  readonly channel?: string;
  readonly status?: string;
  readonly assignedAgentId?: string;
};

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}/analytics${suffix}`;
}

export const analyticsApi = {
  overview: (organizationId: string, params?: AnalyticsPeriodParams) =>
    apiClient.get<AnalyticsOverviewResponse>(orgPath(organizationId, '/overview'), { params }),
  timeseries: (organizationId: string, params?: AnalyticsPeriodParams & { metrics?: string }) =>
    apiClient.get<AnalyticsTimeSeriesResponse>(orgPath(organizationId, '/timeseries'), { params }),
  conversations: (organizationId: string, params?: AnalyticsPeriodParams) =>
    apiClient.get<ConversationAnalyticsResponse>(orgPath(organizationId, '/conversations'), { params }),
  tickets: (organizationId: string, params?: AnalyticsPeriodParams) =>
    apiClient.get<TicketAnalyticsResponse>(orgPath(organizationId, '/tickets'), { params }),
  agents: (organizationId: string, params?: AnalyticsPeriodParams) =>
    apiClient.get<AgentAnalyticsResponse>(orgPath(organizationId, '/agents'), { params }),
  customers: (organizationId: string, params?: AnalyticsPeriodParams) =>
    apiClient.get<CustomerAnalyticsResponse>(orgPath(organizationId, '/customers'), { params }),
  exportUrl: (organizationId: string, report: string, params: AnalyticsPeriodParams): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, String(value));
      }
    }
    const query = search.toString();
    return `/api/organizations/${organizationId}/analytics/exports/${report}${query ? `?${query}` : ''}`;
  },
};
