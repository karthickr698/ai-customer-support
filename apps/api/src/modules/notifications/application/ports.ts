import type { Page, PageRequest } from '@ai-customer-support/shared';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationPreferenceSubjectType,
  NotificationProviderName,
} from '@ai-customer-support/contracts';
import type { NotificationDeliveryAttempt } from '../domain/notification-attempt.js';
import type { NotificationDelivery } from '../domain/notification-delivery.js';
import type { NotificationInboxItem } from '../domain/notification-inbox-item.js';
import type { NotificationPreference } from '../domain/notification-preference.js';
import type { NotificationTemplate } from '../domain/notification-template.js';
import type {
  NotificationAttemptId,
  NotificationDeliveryId,
  NotificationInboxItemId,
  NotificationPreferenceId,
  NotificationTemplateId,
} from '../domain/ids.js';

export type NotificationActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<NotificationActor>;
}

export interface ClockPort {
  now(): Date;
}

export type ProviderMessage = {
  readonly tenantId: string;
  readonly deliveryId: string;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly recipientType: string;
  readonly recipient: string;
  readonly subject?: string;
  readonly body: string;
  readonly payload: Record<string, unknown>;
};

export type ProviderResult = {
  readonly ok: boolean;
  readonly provider: NotificationProviderName;
  readonly providerMessageId?: string;
  readonly error?: string;
};

export interface NotificationProviderPort {
  readonly name: NotificationProviderName;
  readonly channel: NotificationChannel;
  send(message: ProviderMessage): Promise<ProviderResult>;
}

export interface NotificationProviderRegistry {
  resolve(channel: NotificationChannel): NotificationProviderPort;
}

export interface NotificationTemplateRepository {
  save(template: NotificationTemplate): Promise<void>;
  findById(tenantId: string, templateId: NotificationTemplateId): Promise<NotificationTemplate | null>;
  findBySlug(tenantId: string, slug: string): Promise<NotificationTemplate | null>;
  listByTenant(tenantId: string): Promise<NotificationTemplate[]>;
  listEnabledByEvent(tenantId: string, eventType: string): Promise<NotificationTemplate[]>;
  delete(tenantId: string, templateId: NotificationTemplateId): Promise<void>;
  countByTenant(tenantId: string): Promise<number>;
}

export type NotificationDeliveryListFilter = {
  readonly templateId?: NotificationTemplateId;
  readonly status?: NotificationDeliveryStatus;
  readonly channel?: NotificationChannel;
  readonly recipient?: string;
};

export interface NotificationDeliveryRepository {
  save(delivery: NotificationDelivery): Promise<void>;
  tryInsert(delivery: NotificationDelivery): Promise<boolean>;
  findById(tenantId: string, deliveryId: NotificationDeliveryId): Promise<NotificationDelivery | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<NotificationDelivery | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: NotificationDeliveryListFilter,
  ): Promise<Page<NotificationDelivery>>;
  claim(tenantId: string, deliveryId: NotificationDeliveryId, now: Date): Promise<NotificationDelivery | null>;
  listDue(now: Date, limit: number): Promise<NotificationDelivery[]>;
  reclaimStale(now: Date, staleAfterMs: number, limit: number): Promise<NotificationDelivery[]>;
}

export type NotificationAttemptListFilter = {
  readonly deliveryId?: NotificationDeliveryId;
  readonly status?: string;
};

export interface NotificationAttemptRepository {
  save(attempt: NotificationDeliveryAttempt): Promise<void>;
  findById(tenantId: string, attemptId: NotificationAttemptId): Promise<NotificationDeliveryAttempt | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: NotificationAttemptListFilter,
  ): Promise<Page<NotificationDeliveryAttempt>>;
}

export interface NotificationPreferenceRepository {
  save(preference: NotificationPreference): Promise<void>;
  findById(
    tenantId: string,
    preferenceId: NotificationPreferenceId,
  ): Promise<NotificationPreference | null>;
  findBySubjectEventChannel(input: {
    readonly tenantId: string;
    readonly subjectType: NotificationPreferenceSubjectType;
    readonly subjectKey: string;
    readonly eventType: string;
    readonly channel: NotificationChannel;
  }): Promise<NotificationPreference | null>;
  listBySubject(input: {
    readonly tenantId: string;
    readonly subjectType: NotificationPreferenceSubjectType;
    readonly subjectKey: string;
  }): Promise<NotificationPreference[]>;
  countBySubject(input: {
    readonly tenantId: string;
    readonly subjectType: NotificationPreferenceSubjectType;
    readonly subjectKey: string;
  }): Promise<number>;
}

export type NotificationInboxListFilter = {
  readonly unreadOnly?: boolean;
};

export interface NotificationInboxRepository {
  save(item: NotificationInboxItem): Promise<void>;
  findById(
    tenantId: string,
    userId: string,
    itemId: NotificationInboxItemId,
  ): Promise<NotificationInboxItem | null>;
  listByUser(
    tenantId: string,
    userId: string,
    page: PageRequest,
    filter?: NotificationInboxListFilter,
  ): Promise<Page<NotificationInboxItem>>;
  countUnread(tenantId: string, userId: string): Promise<number>;
  markAllRead(tenantId: string, userId: string, now: Date): Promise<number>;
}
