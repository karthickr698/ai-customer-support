import type {
  NotificationChannel,
  NotificationPreferenceSubjectType,
} from '@ai-customer-support/contracts';
import { InvalidNotificationError } from './errors.js';
import { createNotificationPreferenceId, type NotificationPreferenceId } from './ids.js';
import { ALL_EVENTS_PREFERENCE } from './notification-policy.js';
import {
  normalizeText,
  parseChannel,
  parsePreferenceSubjectType,
} from './values.js';

export type NotificationPreferenceSnapshot = {
  readonly id: NotificationPreferenceId;
  readonly organizationId: string;
  readonly subjectType: NotificationPreferenceSubjectType;
  readonly subjectKey: string;
  readonly eventType: string;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class NotificationPreference {
  private constructor(
    readonly id: NotificationPreferenceId,
    readonly organizationId: string,
    readonly subjectType: NotificationPreferenceSubjectType,
    readonly subjectKey: string,
    readonly eventType: string,
    readonly channel: NotificationChannel,
    private enabledValue: boolean,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly subjectType: string;
    readonly subjectKey: string;
    readonly eventType: string;
    readonly channel: string;
    readonly enabled: boolean;
    readonly now: Date;
    readonly id?: NotificationPreferenceId;
  }): NotificationPreference {
    if (!input.organizationId.trim()) {
      throw new InvalidNotificationError('Organization is required');
    }
    return new NotificationPreference(
      input.id ?? createNotificationPreferenceId(),
      input.organizationId,
      parsePreferenceSubjectType(input.subjectType),
      normalizeSubjectKey(input.subjectKey),
      normalizeEventPreference(input.eventType),
      parseChannel(input.channel),
      input.enabled,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: NotificationPreferenceSnapshot): NotificationPreference {
    return new NotificationPreference(
      snapshot.id,
      snapshot.organizationId,
      snapshot.subjectType,
      snapshot.subjectKey,
      snapshot.eventType,
      snapshot.channel,
      snapshot.enabled,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  setEnabled(enabled: boolean, now: Date): void {
    this.enabledValue = enabled;
    this.updatedAtValue = now;
  }

  toSnapshot(): NotificationPreferenceSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      subjectType: this.subjectType,
      subjectKey: this.subjectKey,
      eventType: this.eventType,
      channel: this.channel,
      enabled: this.enabledValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export function isChannelOptedIn(
  preferences: readonly NotificationPreference[],
  input: {
    readonly subjectType: NotificationPreferenceSubjectType;
    readonly subjectKey: string;
    readonly eventType: string;
    readonly channel: NotificationChannel;
  },
): boolean {
  const matching = preferences.filter(
    (preference) =>
      preference.subjectType === input.subjectType &&
      preference.subjectKey === input.subjectKey &&
      preference.channel === input.channel,
  );
  const exact = matching.find((preference) => preference.eventType === input.eventType);
  if (exact) {
    return exact.enabled;
  }
  const wildcard = matching.find((preference) => preference.eventType === ALL_EVENTS_PREFERENCE);
  if (wildcard) {
    return wildcard.enabled;
  }
  return true;
}

function normalizeSubjectKey(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value.length < 1 || value.length > 320) {
    throw new InvalidNotificationError('Preference subject must be between 1 and 320 characters');
  }
  return value;
}

function normalizeEventPreference(raw: string): string {
  const value = normalizeText(raw, 'Event type', 1, 80);
  if (value === ALL_EVENTS_PREFERENCE) {
    return value;
  }
  return value;
}
