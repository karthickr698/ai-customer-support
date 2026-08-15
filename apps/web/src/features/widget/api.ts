import type {
  UpdateWidgetConfigurationRequest,
  WidgetConfigurationResponse,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

export const widgetApi = {
  get: (organizationId: string) =>
    apiClient.get<WidgetConfigurationResponse>(`/api/organizations/${organizationId}/widget`),
  update: (organizationId: string, body: UpdateWidgetConfigurationRequest) =>
    apiClient.patch<WidgetConfigurationResponse>(`/api/organizations/${organizationId}/widget`, body),
  rotateKey: (organizationId: string) =>
    apiClient.post<WidgetConfigurationResponse>(`/api/organizations/${organizationId}/widget/rotate-key`),
};
