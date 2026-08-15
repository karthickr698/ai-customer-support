import {
  NOTIFICATION_ATTEMPT_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PREFERENCE_SUBJECT_TYPES,
  NOTIFICATION_RECIPIENT_TYPES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const createNotificationTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(80),
  channel: z.enum(NOTIFICATION_CHANNELS),
  eventType: z.enum(NOTIFICATION_EVENT_TYPES),
  body: z.string().trim().min(1).max(20_000),
  subject: z.string().trim().max(200).optional(),
  recipientType: z.enum(NOTIFICATION_RECIPIENT_TYPES),
  recipientField: z.string().trim().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  backoffMs: z.number().int().min(100).max(3_600_000).optional(),
});

export const updateNotificationTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  eventType: z.enum(NOTIFICATION_EVENT_TYPES).optional(),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  recipientType: z.enum(NOTIFICATION_RECIPIENT_TYPES).optional(),
  recipientField: z.string().trim().min(1).max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  backoffMs: z.number().int().min(100).max(3_600_000).optional(),
});

export const upsertNotificationPreferencesBodySchema = z.object({
  items: z
    .array(
      z.object({
        eventType: z.string().trim().min(1).max(80),
        channel: z.enum(NOTIFICATION_CHANNELS),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(40),
  subjectType: z.enum(NOTIFICATION_PREFERENCE_SUBJECT_TYPES).optional(),
  subjectKey: z.string().trim().min(1).max(320).optional(),
});

export const notificationPreferenceQuerySchema = z.object({
  subjectType: z.enum(NOTIFICATION_PREFERENCE_SUBJECT_TYPES).optional(),
  subjectKey: z.string().trim().min(1).max(320).optional(),
});

export const sendNotificationBodySchema = z.object({
  recipient: z.object({
    type: z.enum(NOTIFICATION_RECIPIENT_TYPES),
    address: z.string().trim().min(1).max(2_000),
  }),
  templateId: z.string().uuid().optional(),
  templateSlug: z.string().trim().min(1).max(80).optional(),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  eventType: z.enum(NOTIFICATION_EVENT_TYPES).optional(),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(1).max(80).optional(),
  ignorePreferences: z.boolean().optional(),
});

export const notificationDeliveryListQuerySchema = z.object({
  ...pageQuery,
  templateId: z.string().uuid().optional(),
  status: z.enum(NOTIFICATION_DELIVERY_STATUSES).optional(),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  recipient: z.string().trim().min(1).max(320).optional(),
});

export const notificationAttemptListQuerySchema = z.object({
  ...pageQuery,
  deliveryId: z.string().uuid().optional(),
  status: z.enum(NOTIFICATION_ATTEMPT_STATUSES).optional(),
});

export const notificationInboxListQuerySchema = z.object({
  ...pageQuery,
  unreadOnly: z.coerce.boolean().optional(),
});
