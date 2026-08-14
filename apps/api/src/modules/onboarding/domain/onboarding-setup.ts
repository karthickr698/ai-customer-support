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
import {
  BusinessProfileRequiredError,
  InvalidOnboardingStateError,
  InvalidSupportToneError,
} from './errors.js';
import { createOnboardingId, type OnboardingId } from './onboarding-id.js';

export type OnboardingSetupSnapshot = {
  readonly id: OnboardingId;
  readonly organizationId: string;
  readonly status: OnboardingStatus;
  readonly businessProfile?: BusinessProfileDto;
  readonly tonePresets: readonly SupportTonePresetDto[];
  readonly selectedToneId?: SupportToneId;
  readonly agentSettings?: AgentSettingsDto;
  readonly createdByUserId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class OnboardingSetup {
  private constructor(
    readonly id: OnboardingId,
    readonly organizationId: string,
    private statusValue: OnboardingStatus,
    private businessProfileValue: BusinessProfileDto | undefined,
    private tonePresetsValue: readonly SupportTonePresetDto[],
    private selectedToneIdValue: SupportToneId | undefined,
    private agentSettingsValue: AgentSettingsDto | undefined,
    readonly createdByUserId: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly now: Date;
    readonly createdByUserId?: string;
    readonly id?: OnboardingId;
  }): OnboardingSetup {
    return new OnboardingSetup(
      input.id ?? createOnboardingId(),
      input.organizationId,
      'not_started',
      undefined,
      [],
      undefined,
      undefined,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: OnboardingSetupSnapshot): OnboardingSetup {
    return new OnboardingSetup(
      snapshot.id,
      snapshot.organizationId,
      snapshot.status,
      snapshot.businessProfile,
      snapshot.tonePresets,
      snapshot.selectedToneId,
      snapshot.agentSettings,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): OnboardingStatus {
    return this.statusValue;
  }

  get businessProfile(): BusinessProfileDto | undefined {
    return this.businessProfileValue;
  }

  get tonePresets(): readonly SupportTonePresetDto[] {
    return this.tonePresetsValue;
  }

  get selectedToneId(): SupportToneId | undefined {
    return this.selectedToneIdValue;
  }

  get agentSettings(): AgentSettingsDto | undefined {
    return this.agentSettingsValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  applyBusinessProfile(profile: BusinessProfileDto, now: Date): void {
    if (!isBusinessProfileDto(profile)) {
      throw new InvalidOnboardingStateError('Business profile is invalid');
    }
    this.businessProfileValue = profile;
    this.touch(now);
  }

  applyTonePresets(
    presets: readonly SupportTonePresetDto[],
    selectedToneId: SupportToneId,
    now: Date,
  ): void {
    if (!isSupportTonePresetList(presets)) {
      throw new InvalidOnboardingStateError('Support-tone presets are invalid');
    }
    if (!presets.some((preset) => preset.id === selectedToneId)) {
      throw new InvalidSupportToneError();
    }
    this.tonePresetsValue = presets;
    this.selectedToneIdValue = selectedToneId;
    this.touch(now);
  }

  selectTone(toneId: SupportToneId, now: Date): void {
    if (!isSupportToneId(toneId) || !this.tonePresetsValue.some((preset) => preset.id === toneId)) {
      throw new InvalidSupportToneError();
    }
    this.selectedToneIdValue = toneId;
    if (this.agentSettingsValue) {
      this.agentSettingsValue = { ...this.agentSettingsValue, selectedToneId: toneId };
    }
    this.touch(now);
  }

  applyAgentSettings(settings: AgentSettingsDto, now: Date): void {
    if (!this.businessProfileValue) {
      throw new BusinessProfileRequiredError();
    }
    if (!isAgentSettingsDto(settings)) {
      throw new InvalidOnboardingStateError('Agent settings are invalid');
    }
    const selected = this.selectedToneIdValue ?? settings.selectedToneId;
    if (this.tonePresetsValue.length > 0 && !this.tonePresetsValue.some((preset) => preset.id === selected)) {
      throw new InvalidSupportToneError();
    }
    this.selectedToneIdValue = selected;
    this.agentSettingsValue = { ...settings, selectedToneId: selected };
    this.touch(now);
  }

  patchAgentSettings(patch: Partial<AgentSettingsDto>, now: Date): AgentSettingsDto {
    if (!this.agentSettingsValue) {
      throw new InvalidOnboardingStateError('Generate agent settings before updating them');
    }
    const next: AgentSettingsDto = {
      ...this.agentSettingsValue,
      ...patch,
      schemaVersion: this.agentSettingsValue.schemaVersion,
      selectedToneId: patch.selectedToneId ?? this.agentSettingsValue.selectedToneId,
    };
    this.applyAgentSettings(next, now);
    return next;
  }

  requireBusinessProfile(): BusinessProfileDto {
    if (!this.businessProfileValue) {
      throw new BusinessProfileRequiredError();
    }
    return this.businessProfileValue;
  }

  toSnapshot(): OnboardingSetupSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      status: this.statusValue,
      businessProfile: this.businessProfileValue,
      tonePresets: this.tonePresetsValue,
      selectedToneId: this.selectedToneIdValue,
      agentSettings: this.agentSettingsValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }

  private touch(now: Date): void {
    this.updatedAtValue = now;
    this.statusValue =
      this.businessProfileValue && this.selectedToneIdValue && this.agentSettingsValue
        ? 'completed'
        : this.businessProfileValue || this.tonePresetsValue.length > 0 || this.agentSettingsValue
          ? 'in_progress'
          : 'not_started';
  }
}
