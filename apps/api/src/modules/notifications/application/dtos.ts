import type {
  NotificationAttemptDto,
  NotificationDeliveryDto,
  NotificationInboxItemDto,
  NotificationPreferenceDto,
  NotificationTemplateDto,
} from '@ai-customer-support/contracts';
import type { NotificationDeliveryAttempt } from '../domain/notification-attempt.js';
import type { NotificationDelivery } from '../domain/notification-delivery.js';
import type { NotificationInboxItem } from '../domain/notification-inbox-item.js';
import type { NotificationPreference } from '../domain/notification-preference.js';
import type { NotificationTemplate } from '../domain/notification-template.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toTemplateDto(template: NotificationTemplate): NotificationTemplateDto {
  const snapshot = template.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    slug: snapshot.slug,
    channel: snapshot.channel,
    eventType: snapshot.eventType,
    subject: snapshot.subject ?? null,
    body: snapshot.body,
    recipientType: snapshot.recipientType,
    recipientField: snapshot.recipientField ?? null,
    enabled: snapshot.enabled,
    maxAttempts: snapshot.maxAttempts,
    backoffMs: snapshot.backoffMs,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toPreferenceDto(preference: NotificationPreference): NotificationPreferenceDto {
  const snapshot = preference.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subjectType: snapshot.subjectType,
    subjectKey: snapshot.subjectKey,
    eventType: snapshot.eventType,
    channel: snapshot.channel,
    enabled: snapshot.enabled,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toDeliveryDto(delivery: NotificationDelivery): NotificationDeliveryDto {
  const snapshot = delivery.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    templateId: snapshot.templateId ?? null,
    channel: snapshot.channel,
    eventType: snapshot.eventType,
    eventId: snapshot.eventId ?? null,
    triggerKind: snapshot.triggerKind,
    idempotencyKey: snapshot.idempotencyKey,
    recipientType: snapshot.recipientType,
    recipient: snapshot.recipient,
    subject: snapshot.subject ?? null,
    body: snapshot.body,
    payload: snapshot.payload,
    status: snapshot.status,
    attempt: snapshot.attempt,
    maxAttempts: snapshot.maxAttempts,
    runAfter: snapshot.runAfter.toISOString(),
    lastError: snapshot.lastError ?? null,
    provider: snapshot.provider ?? null,
    providerMessageId: snapshot.providerMessageId ?? null,
    claimedAt: snapshot.claimedAt?.toISOString() ?? null,
    deliveredAt: snapshot.deliveredAt?.toISOString() ?? null,
    completedAt: snapshot.completedAt?.toISOString() ?? null,
    createdByUserId: snapshot.createdByUserId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toAttemptDto(attempt: NotificationDeliveryAttempt): NotificationAttemptDto {
  const snapshot = attempt.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    deliveryId: snapshot.deliveryId,
    attempt: snapshot.attempt,
    status: snapshot.status,
    provider: snapshot.provider ?? null,
    providerMessageId: snapshot.providerMessageId ?? null,
    message: snapshot.message ?? null,
    startedAt: snapshot.startedAt.toISOString(),
    finishedAt: snapshot.finishedAt?.toISOString() ?? null,
  };
}

export function toInboxDto(item: NotificationInboxItem): NotificationInboxItemDto {
  const snapshot = item.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    userId: snapshot.userId,
    deliveryId: snapshot.deliveryId,
    eventType: snapshot.eventType,
    title: snapshot.title,
    body: snapshot.body,
    readAt: snapshot.readAt?.toISOString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
