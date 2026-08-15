import type {
  NotificationAttemptStatus,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationPreferenceSubjectType,
  NotificationProviderName,
  NotificationRecipientType,
  NotificationTriggerKind,
} from '@ai-customer-support/contracts';
import {
  NOTIFICATION_ATTEMPT_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PREFERENCE_SUBJECT_TYPES,
  NOTIFICATION_PROVIDERS,
  NOTIFICATION_RECIPIENT_TYPES,
  NOTIFICATION_TRIGGER_KINDS,
} from '@ai-customer-support/contracts';
import { InvalidNotificationError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function parseChannel(value: string): NotificationChannel {
  if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Channel must be email, in_app, sms, or webhook');
  }
  return value as NotificationChannel;
}

export function parseEventType(value: string): NotificationEventType {
  if (!(NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Event type is not an allowed notification event');
  }
  return value as NotificationEventType;
}

export function parseRecipientType(value: string): NotificationRecipientType {
  if (!(NOTIFICATION_RECIPIENT_TYPES as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Recipient type must be user, email, phone, or url');
  }
  return value as NotificationRecipientType;
}

export function parsePreferenceSubjectType(value: string): NotificationPreferenceSubjectType {
  if (!(NOTIFICATION_PREFERENCE_SUBJECT_TYPES as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Preference subject type must be user, email, or phone');
  }
  return value as NotificationPreferenceSubjectType;
}

export function parseDeliveryStatus(value: string): NotificationDeliveryStatus {
  if (!(NOTIFICATION_DELIVERY_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Notification delivery status is invalid');
  }
  return value as NotificationDeliveryStatus;
}

export function parseAttemptStatus(value: string): NotificationAttemptStatus {
  if (!(NOTIFICATION_ATTEMPT_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Notification attempt status is invalid');
  }
  return value as NotificationAttemptStatus;
}

export function parseTriggerKind(value: string): NotificationTriggerKind {
  if (!(NOTIFICATION_TRIGGER_KINDS as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Trigger kind must be event or manual');
  }
  return value as NotificationTriggerKind;
}

export function parseProviderName(value: string | undefined): NotificationProviderName | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!(NOTIFICATION_PROVIDERS as readonly string[]).includes(value)) {
    throw new InvalidNotificationError('Notification provider is invalid');
  }
  return value as NotificationProviderName;
}

export function parseRetryPolicy(input: {
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
}): { maxAttempts: number; backoffMs: number } {
  const maxAttempts = input.maxAttempts ?? 5;
  const backoffMs = input.backoffMs ?? 2_000;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new InvalidNotificationError('maxAttempts must be an integer between 1 and 20');
  }
  if (!Number.isInteger(backoffMs) || backoffMs < 100 || backoffMs > 3_600_000) {
    throw new InvalidNotificationError('backoffMs must be an integer between 100 and 3600000');
  }
  return { maxAttempts, backoffMs };
}

export function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidNotificationError(`${label} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function normalizeOptionalText(
  raw: string | null | undefined,
  label: string,
  max: number,
): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  if (value.length > max) {
    throw new InvalidNotificationError(`${label} must be at most ${max} characters`);
  }
  return value;
}

export function normalizeSlug(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!SLUG_PATTERN.test(value) || value.length > 80) {
    throw new InvalidNotificationError(
      'Slug must be lowercase letters, numbers, and hyphens, at most 80 characters',
    );
  }
  return value;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new InvalidNotificationError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function retryDelayMs(attempt: number, backoffMs: number): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(backoffMs * 2 ** exponent, 3_600_000);
}

export function readPath(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter((part) => part.length > 0);
  let current: unknown = source;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function normalizeRecipient(
  type: NotificationRecipientType,
  address: string,
): string {
  const value = address.trim();
  if (type === 'user') {
    return requireUuid(value, 'Recipient');
  }
  if (type === 'email') {
    const email = value.toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 320) {
      throw new InvalidNotificationError('Recipient must be a valid email address');
    }
    return email;
  }
  if (type === 'phone') {
    if (!PHONE_PATTERN.test(value)) {
      throw new InvalidNotificationError('Recipient must be an E.164 phone number');
    }
    return value;
  }
  return value;
}

export function preferenceSubjectForRecipient(
  type: NotificationRecipientType,
  address: string,
): { subjectType: NotificationPreferenceSubjectType; subjectKey: string } | undefined {
  if (type === 'user') {
    return { subjectType: 'user', subjectKey: address.trim().toLowerCase() };
  }
  if (type === 'email') {
    return { subjectType: 'email', subjectKey: address.trim().toLowerCase() };
  }
  if (type === 'phone') {
    return { subjectType: 'phone', subjectKey: address.trim().toLowerCase() };
  }
  return undefined;
}

export function channelMatchesRecipient(
  channel: NotificationChannel,
  recipientType: NotificationRecipientType,
): boolean {
  if (channel === 'email') {
    return recipientType === 'email';
  }
  if (channel === 'in_app') {
    return recipientType === 'user';
  }
  if (channel === 'sms') {
    return recipientType === 'phone';
  }
  return recipientType === 'url';
}
