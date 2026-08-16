import type {
  AutomationExecutionLogListResponse,
  AutomationJobListResponse,
  AutomationJobResponse,
  AutomationRuleListResponse,
  AutomationRuleResponse,
  CreateAutomationRuleRequest,
  DispatchAutomationsResponse,
  RunAutomationRequest,
  RunAutomationResponse,
  UpdateAutomationRuleRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export type AutomationJobListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly ruleId?: string;
  readonly status?: string;
};

export const automationsApi = {
  listRules: (organizationId: string) =>
    apiClient.get<AutomationRuleListResponse>(orgPath(organizationId, '/automations')),
  getRule: (organizationId: string, ruleId: string) =>
    apiClient.get<AutomationRuleResponse>(orgPath(organizationId, `/automations/${ruleId}`)),
  createRule: (organizationId: string, body: CreateAutomationRuleRequest) =>
    apiClient.post<AutomationRuleResponse>(orgPath(organizationId, '/automations'), body),
  updateRule: (organizationId: string, ruleId: string, body: UpdateAutomationRuleRequest) =>
    apiClient.patch<AutomationRuleResponse>(orgPath(organizationId, `/automations/${ruleId}`), body),
  deleteRule: (organizationId: string, ruleId: string) =>
    apiClient.delete<void>(orgPath(organizationId, `/automations/${ruleId}`)),
  enable: (organizationId: string, ruleId: string) =>
    apiClient.post<AutomationRuleResponse>(orgPath(organizationId, `/automations/${ruleId}/enable`)),
  disable: (organizationId: string, ruleId: string) =>
    apiClient.post<AutomationRuleResponse>(orgPath(organizationId, `/automations/${ruleId}/disable`)),
  run: (organizationId: string, ruleId: string, body: RunAutomationRequest = {}) =>
    apiClient.post<RunAutomationResponse>(orgPath(organizationId, `/automations/${ruleId}/run`), body),
  listJobs: (organizationId: string, params?: AutomationJobListParams) =>
    apiClient.get<AutomationJobListResponse>(orgPath(organizationId, '/automation-jobs'), { params }),
  getJob: (organizationId: string, jobId: string) =>
    apiClient.get<AutomationJobResponse>(orgPath(organizationId, `/automation-jobs/${jobId}`)),
  retryJob: (organizationId: string, jobId: string) =>
    apiClient.post<AutomationJobResponse>(orgPath(organizationId, `/automation-jobs/${jobId}/retry`)),
  listLogs: (organizationId: string, params?: AutomationJobListParams & { jobId?: string }) =>
    apiClient.get<AutomationExecutionLogListResponse>(orgPath(organizationId, '/automation-logs'), { params }),
  dispatch: (organizationId: string) =>
    apiClient.post<DispatchAutomationsResponse>(orgPath(organizationId, '/automations/dispatch')),
};
