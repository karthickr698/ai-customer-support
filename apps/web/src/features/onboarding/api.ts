import type {
  AgentSettingsResponse,
  BusinessProfileResponse,
  GenerateBusinessProfileRequest,
  KnowledgeSourceListResponse,
  KnowledgeSourceResponse,
  OnboardingResponse,
  RegisterKnowledgeSourceRequest,
  RunOnboardingSetupRequest,
  SelectSupportToneRequest,
  SupportTonePresetListResponse,
  UpdateAgentSettingsRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

const ONBOARDING_TIMEOUT_MS = 120_000;

function onboardingPath(organizationId: string, suffix = ''): string {
  return `/api/organizations/${organizationId}/onboarding${suffix}`;
}

export const onboardingApi = {
  get: (organizationId: string) =>
    apiClient.get<OnboardingResponse>(onboardingPath(organizationId)),

  runSetup: (organizationId: string, body: RunOnboardingSetupRequest) =>
    apiClient.post<OnboardingResponse>(onboardingPath(organizationId, '/setup'), body, {
      timeoutMs: ONBOARDING_TIMEOUT_MS,
    }),

  generateBusinessProfile: (organizationId: string, body: GenerateBusinessProfileRequest) =>
    apiClient.post<BusinessProfileResponse & OnboardingResponse>(
      onboardingPath(organizationId, '/business-profile'),
      body,
      { timeoutMs: ONBOARDING_TIMEOUT_MS },
    ),

  generateTonePresets: (organizationId: string) =>
    apiClient.post<SupportTonePresetListResponse & OnboardingResponse>(
      onboardingPath(organizationId, '/tone-presets'),
      undefined,
      { timeoutMs: ONBOARDING_TIMEOUT_MS },
    ),

  selectTone: (organizationId: string, body: SelectSupportToneRequest) =>
    apiClient.patch<SupportTonePresetListResponse & OnboardingResponse>(
      onboardingPath(organizationId, '/tone-presets'),
      body,
    ),

  generateAgentSettings: (organizationId: string) =>
    apiClient.post<AgentSettingsResponse & OnboardingResponse>(
      onboardingPath(organizationId, '/agent-settings'),
      undefined,
      { timeoutMs: ONBOARDING_TIMEOUT_MS },
    ),

  updateAgentSettings: (organizationId: string, body: UpdateAgentSettingsRequest) =>
    apiClient.patch<AgentSettingsResponse & OnboardingResponse>(
      onboardingPath(organizationId, '/agent-settings'),
      body,
    ),

  listKnowledgeSources: (organizationId: string) =>
    apiClient.get<KnowledgeSourceListResponse>(`/api/organizations/${organizationId}/knowledge/sources`),

  registerKnowledgeSource: (organizationId: string, body: RegisterKnowledgeSourceRequest) =>
    apiClient.post<KnowledgeSourceResponse>(`/api/organizations/${organizationId}/knowledge/sources`, body),
};
