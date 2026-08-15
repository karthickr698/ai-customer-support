import type { KnowledgeSourceDto, OnboardingDto } from '@ai-customer-support/contracts';
import type { OnboardingSetup } from '../domain/onboarding-setup.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
};

export function toOnboardingDto(
  setup: OnboardingSetup,
  knowledgeSources: readonly KnowledgeSourceDto[],
): OnboardingDto {
  const snapshot = setup.toSnapshot();
  return {
    organizationId: snapshot.organizationId,
    status: snapshot.status,
    businessProfile: snapshot.businessProfile ?? null,
    tonePresets: snapshot.tonePresets,
    selectedToneId: snapshot.selectedToneId ?? null,
    agentSettings: snapshot.agentSettings ?? null,
    knowledgeSources,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function emptyOnboardingDto(
  tenantId: string,
  knowledgeSources: readonly KnowledgeSourceDto[],
  now: Date,
): OnboardingDto {
  return {
    organizationId: tenantId,
    status: 'not_started',
    businessProfile: null,
    tonePresets: [],
    selectedToneId: null,
    agentSettings: null,
    knowledgeSources,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
