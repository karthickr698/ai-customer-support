import type { Prisma, PrismaClient } from '@prisma/client';
import {
  isAgentSettingsDto,
  isBusinessProfileDto,
  isSupportToneId,
  isSupportTonePresetList,
  type AgentSettingsDto,
  type BusinessProfileDto,
  type OnboardingStatus,
  type SupportToneId,
  type SupportTonePresetDto,
} from '@ai-customer-support/contracts';
import type { OnboardingRepository } from '../../../application/ports/onboarding-repository.js';
import { InvalidOnboardingStateError } from '../../../domain/errors.js';
import { createOnboardingId } from '../../../domain/onboarding-id.js';
import { OnboardingSetup, type OnboardingSetupSnapshot } from '../../../domain/onboarding-setup.js';

type OnboardingRecord = {
  id: string;
  organizationId: string;
  status: string;
  businessProfile: Prisma.JsonValue | null;
  tonePresets: Prisma.JsonValue | null;
  selectedToneId: string | null;
  agentSettings: Prisma.JsonValue | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresOnboardingRepository implements OnboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenant(tenantId: string): Promise<OnboardingSetup | null> {
    const record = await this.prisma.organizationOnboarding.findUnique({
      where: { organizationId: tenantId },
    });
    return record ? toSetup(record) : null;
  }

  async save(setup: OnboardingSetup): Promise<void> {
    const snapshot = setup.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.organizationOnboarding.upsert({
      where: { organizationId: snapshot.organizationId },
      create: data,
      update: {
        status: data.status,
        businessProfile: data.businessProfile,
        tonePresets: data.tonePresets,
        selectedToneId: data.selectedToneId,
        agentSettings: data.agentSettings,
        updatedAt: data.updatedAt,
      },
    });
  }
}

function toSetup(record: OnboardingRecord): OnboardingSetup {
  const snapshot: OnboardingSetupSnapshot = {
    id: createOnboardingId(record.id),
    organizationId: record.organizationId,
    status: parseStatus(record.status),
    businessProfile: parseProfile(record.businessProfile),
    tonePresets: parseTones(record.tonePresets),
    selectedToneId: parseToneId(record.selectedToneId),
    agentSettings: parseSettings(record.agentSettings),
    createdByUserId: record.createdByUserId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return OnboardingSetup.reconstitute(snapshot);
}

function toRecord(snapshot: OnboardingSetupSnapshot): Prisma.OrganizationOnboardingUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    status: snapshot.status,
    businessProfile: snapshot.businessProfile
      ? (structuredClone(snapshot.businessProfile) as Prisma.InputJsonValue)
      : undefined,
    tonePresets: snapshot.tonePresets.length
      ? (structuredClone(snapshot.tonePresets) as Prisma.InputJsonValue)
      : undefined,
    selectedToneId: snapshot.selectedToneId ?? null,
    agentSettings: snapshot.agentSettings
      ? (structuredClone(snapshot.agentSettings) as Prisma.InputJsonValue)
      : undefined,
    createdByUserId: snapshot.createdByUserId ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function parseStatus(value: string): OnboardingStatus {
  if (value === 'not_started' || value === 'in_progress' || value === 'completed') {
    return value;
  }
  throw new InvalidOnboardingStateError('Stored onboarding status is invalid');
}

function parseProfile(value: Prisma.JsonValue | null): BusinessProfileDto | undefined {
  if (value === null) {
    return undefined;
  }
  if (!isBusinessProfileDto(value)) {
    throw new InvalidOnboardingStateError('Stored business profile is invalid');
  }
  return value;
}

function parseTones(value: Prisma.JsonValue | null): readonly SupportTonePresetDto[] {
  if (value === null) {
    return [];
  }
  if (!isSupportTonePresetList(value) && !(Array.isArray(value) && value.length === 0)) {
    throw new InvalidOnboardingStateError('Stored support-tone presets are invalid');
  }
  return Array.isArray(value) ? (value as SupportTonePresetDto[]) : [];
}

function parseToneId(value: string | null): SupportToneId | undefined {
  if (value === null) {
    return undefined;
  }
  if (!isSupportToneId(value)) {
    throw new InvalidOnboardingStateError('Stored support tone is invalid');
  }
  return value;
}

function parseSettings(value: Prisma.JsonValue | null): AgentSettingsDto | undefined {
  if (value === null) {
    return undefined;
  }
  if (!isAgentSettingsDto(value)) {
    throw new InvalidOnboardingStateError('Stored agent settings are invalid');
  }
  return value;
}
