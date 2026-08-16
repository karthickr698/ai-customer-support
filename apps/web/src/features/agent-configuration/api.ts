import type {
  AiAgentConfigurationResponse,
  UpdateAiAgentConfigurationRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

export const agentConfigurationApi = {
  get: (organizationId: string) =>
    apiClient.get<AiAgentConfigurationResponse>(`/api/organizations/${organizationId}/ai-agent`),
  update: (organizationId: string, body: UpdateAiAgentConfigurationRequest) =>
    apiClient.patch<AiAgentConfigurationResponse>(`/api/organizations/${organizationId}/ai-agent`, body),
};
