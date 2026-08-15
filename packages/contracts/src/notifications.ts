/**
 * Cross-runtime DTOs for tenant-scoped notification templates, preferences,
 * queued deliveries, provider results, and in-app inbox items.
 */

import { AUTOMATION_SOURCE_EVENTS } from './automations.js';

export const NOTIFICATION_CHANNELS = ['email', 'in_app', 'sms', 'webhook'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENT_TYPES = ['manual', ...AUTOMATION_SOURCE_EVENTS] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_SOURCE_EVENTS = AUTOMATION_SOURCE_EVENTS;
export type NotificationSourceEvent = (typeof NOTIFICATION_SOURCE_EVENTS)[number];

export const NOTIFICATION_RECIPIENT_TYPES = ['user', 'email', 'phone', 'url'] as const;
export type NotificationRecipientType = (typeof NOTIFICATION_RECIPIENT_TYPES)[number];

export const NOTIFICATION_PREFERENCE_SUBJECT_TYPES = ['user', 'email', 'phone'] as const;
export type NotificationPreferenceSubjectType = (typeof NOTIFICATION_PREFERENCE_SUBJECT_TYPES)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  'pending',
  'sending',
  'delivered',
  'skipped',
  'dead',
] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATION_ATTEMPT_STATUSES = ['started', 'delivered', 'failed', 'skipped'] as const;
export type NotificationAttemptStatus = (typeof NOTIFICATION_ATTEMPT_STATUSES)[number];

export const NOTIFICATION_TRIGGER_KINDS = ['event', 'manual'] as const;
export type NotificationTriggerKind = (typeof NOTIFICATION_TRIGGER_KINDS)[number];

export const NOTIFICATION_PROVIDERS = ['smtp', 'console', 'in_app', 'sms_console', 'webhook'] as const;
export type NotificationProviderName = (typeof NOTIFICATION_PROVIDERS)[number];

export type NotificationTemplateDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly subject: string | null;
  readonly body: string;
  readonly recipientType: NotificationRecipientType;
  readonly recipientField: string | null;
  readonly enabled: boolean;
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateNotificationTemplateRequest = {
  readonly name: string;
  readonly slug: string;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly body: string;
  readonly subject?: string;
  readonly recipientType: NotificationRecipientType;
  readonly recipientField?: string;
  readonly enabled?: boolean;
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
};

export type UpdateNotificationTemplateRequest = {
  readonly name?: string;
  readonly slug?: string;
  readonly channel?: NotificationChannel;
  readonly eventType?: NotificationEventType;
  readonly subject?: string | null;
  readonly body?: string;
  readonly recipientType?: NotificationRecipientType;
  readonly recipientField?: string | null;
  readonly enabled?: boolean;
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
};

export type NotificationTemplateResponse = {
  readonly template: NotificationTemplateDto;
};

export type NotificationTemplateListResponse = {
  readonly items: readonly NotificationTemplateDto[];
};

export type NotificationPreferenceDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly subjectType: NotificationPreferenceSubjectType;
  readonly subjectKey: string;
  readonly eventType: string;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type UpsertNotificationPreferenceItem = {
  readonly eventType: string;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
};

export type UpsertNotificationPreferencesRequest = {
  readonly items: readonly UpsertNotificationPreferenceItem[];
  readonly subjectType?: NotificationPreferenceSubjectType;
  readonly subjectKey?: string;
};

export type NotificationPreferenceListResponse = {
  readonly items: readonly NotificationPreferenceDto[];
};

export type NotificationRecipientDto = {
  readonly type: NotificationRecipientType;
  readonly address: string;
};

export type SendNotificationRequest = {
  readonly recipient: NotificationRecipientDto;
  readonly templateId?: string;
  readonly templateSlug?: string;
  readonly channel?: NotificationChannel;
  readonly eventType?: NotificationEventType;
  readonly subject?: string;
  readonly body?: string;
  readonly data?: Record<string, unknown>;
  readonly idempotencyKey?: string;
  readonly ignorePreferences?: boolean;
};

export type NotificationDeliveryDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly templateId: string | null;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly eventId: string | null;
  readonly triggerKind: NotificationTriggerKind;
  readonly idempotencyKey: string;
  readonly recipientType: NotificationRecipientType;
  readonly recipient: string;
  readonly subject: string | null;
  readonly body: string;
  readonly payload: Record<string, unknown>;
  readonly status: NotificationDeliveryStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly runAfter: string;
  readonly lastError: string | null;
  readonly provider: NotificationProviderName | null;
  readonly providerMessageId: string | null;
  readonly claimedAt: string | null;
  readonly deliveredAt: string | null;
  readonly completedAt: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NotificationDeliveryResponse = {
  readonly delivery: NotificationDeliveryDto;
};

export type SendNotificationResponse = {
  readonly delivery: NotificationDeliveryDto;
  readonly created: boolean;
};

export type NotificationDeliveryListResponse = {
  readonly items: readonly NotificationDeliveryDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type NotificationAttemptDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly deliveryId: string;
  readonly attempt: number;
  readonly status: NotificationAttemptStatus;
  readonly provider: NotificationProviderName | null;
  readonly providerMessageId: string | null;
  readonly message: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
};

export type NotificationAttemptListResponse = {
  readonly items: readonly NotificationAttemptDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type NotificationInboxItemDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly deliveryId: string;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly readAt: string | null;
  readonly createdAt: string;
};

export type NotificationInboxListResponse = {
  readonly items: readonly NotificationInboxItemDto[];
  readonly unreadCount: number;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type NotificationInboxItemResponse = {
  readonly item: NotificationInboxItemDto;
};

export type DispatchNotificationsResponse = {
  readonly enqueued: number;
};
