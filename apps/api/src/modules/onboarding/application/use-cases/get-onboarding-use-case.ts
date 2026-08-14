import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { OnboardingSetup } from '../../domain/onboarding-setup.js';
import { OnboardingPolicy } from '../../domain/onboarding-policy.js';
import { emptyOnboardingDto, toOnboardingDto, type RequestSecurityContext } from '../dtos.js';
import type { KnowledgeSourceDirectoryPort } from '../ports/knowledge-source-ports.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OnboardingRepository } from '../ports/onboarding-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class GetOnboardingUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly onboardings: OnboardingRepository,
    private readonly knowledgeSources: KnowledgeSourceDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly tenantId: string; readonly actorId: string }) {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    OnboardingPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    const sources = await this.knowledgeSources.listByTenant(actor.tenantId);
    const setup = await this.onboardings.findByTenant(actor.tenantId);
    if (!setup) {
      return { onboarding: emptyOnboardingDto(actor.tenantId, sources, this.clock.now()) };
    }
    return { onboarding: toOnboardingDto(setup, sources) };
  }
}

export async function loadOrCreateOnboarding(
  onboardings: OnboardingRepository,
  tenantId: string,
  actorId: string,
  now: Date,
): Promise<OnboardingSetup> {
  const existing = await onboardings.findByTenant(tenantId);
  if (existing) {
    return existing;
  }
  return OnboardingSetup.create({
    organizationId: tenantId,
    createdByUserId: actorId,
    now,
  });
}

export function aiContext(tenantId: string, security: RequestSecurityContext) {
  return {
    tenantId,
    requestId: security.requestId,
    correlationId: security.correlationId ?? security.requestId,
  };
}

export type { AIServicePort };
