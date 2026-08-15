import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { NotificationDeliveryAttempt, type NotificationAttemptSnapshot } from '../../../domain/notification-attempt.js';
import {
  NotificationDelivery,
  payloadRecord,
  type NotificationDeliverySnapshot,
} from '../../../domain/notification-delivery.js';
import { NotificationInboxItem, type NotificationInboxItemSnapshot } from '../../../domain/notification-inbox-item.js';
import { NotificationPreference, type NotificationPreferenceSnapshot } from '../../../domain/notification-preference.js';
import { NotificationTemplate, type NotificationTemplateSnapshot } from '../../../domain/notification-template.js';
import {
  createNotificationAttemptId,
  createNotificationDeliveryId,
  createNotificationInboxItemId,
  createNotificationPreferenceId,
  createNotificationTemplateId,
  type NotificationAttemptId,
  type NotificationDeliveryId,
  type NotificationInboxItemId,
  type NotificationPreferenceId,
  type NotificationTemplateId,
} from '../../../domain/ids.js';
import {
  parseAttemptStatus,
  parseChannel,
  parseDeliveryStatus,
  parseEventType,
  parsePreferenceSubjectType,
  parseProviderName,
  parseRecipientType,
  parseTriggerKind,
} from '../../../domain/values.js';
import type {
  NotificationAttemptListFilter,
  NotificationAttemptRepository,
  NotificationDeliveryListFilter,
  NotificationDeliveryRepository,
  NotificationInboxListFilter,
  NotificationInboxRepository,
  NotificationPreferenceRepository,
  NotificationTemplateRepository,
} from '../../../application/ports.js';

export class PostgresNotificationTemplateRepository implements NotificationTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(template: NotificationTemplate): Promise<void> {
    const snapshot = template.toSnapshot();
    const data = toTemplateRecord(snapshot);
    await this.prisma.notificationTemplate.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        slug: data.slug,
        channel: data.channel,
        eventType: data.eventType,
        subject: data.subject,
        body: data.body,
        recipientType: data.recipientType,
        recipientField: data.recipientField,
        enabled: data.enabled,
        maxAttempts: data.maxAttempts,
        backoffMs: data.backoffMs,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, templateId: NotificationTemplateId): Promise<NotificationTemplate | null> {
    const record = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, organizationId: tenantId },
    });
    return record ? toTemplate(record) : null;
  }

  async findBySlug(tenantId: string, slug: string): Promise<NotificationTemplate | null> {
    const record = await this.prisma.notificationTemplate.findFirst({
      where: { organizationId: tenantId, slug },
    });
    return record ? toTemplate(record) : null;
  }

  async listByTenant(tenantId: string): Promise<NotificationTemplate[]> {
    const records = await this.prisma.notificationTemplate.findMany({
      where: { organizationId: tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return records.map(toTemplate);
  }

  async listEnabledByEvent(tenantId: string, eventType: string): Promise<NotificationTemplate[]> {
    const records = await this.prisma.notificationTemplate.findMany({
      where: { organizationId: tenantId, enabled: true, eventType },
      orderBy: { updatedAt: 'asc' },
    });
    return records.map(toTemplate);
  }

  async delete(tenantId: string, templateId: NotificationTemplateId): Promise<void> {
    await this.prisma.notificationTemplate.deleteMany({
      where: { id: templateId, organizationId: tenantId },
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.notificationTemplate.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresNotificationDeliveryRepository implements NotificationDeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(delivery: NotificationDelivery): Promise<void> {
    const snapshot = delivery.toSnapshot();
    const data = toDeliveryRecord(snapshot);
    await this.prisma.notificationDelivery.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        attempt: data.attempt,
        runAfter: data.runAfter,
        lastError: data.lastError,
        provider: data.provider,
        providerMessageId: data.providerMessageId,
        claimedAt: data.claimedAt,
        deliveredAt: data.deliveredAt,
        completedAt: data.completedAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async tryInsert(delivery: NotificationDelivery): Promise<boolean> {
    try {
      await this.prisma.notificationDelivery.create({ data: toDeliveryRecord(delivery.toSnapshot()) });
      return true;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async findById(tenantId: string, deliveryId: NotificationDeliveryId): Promise<NotificationDelivery | null> {
    const record = await this.prisma.notificationDelivery.findFirst({
      where: { id: deliveryId, organizationId: tenantId },
    });
    return record ? toDelivery(record) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<NotificationDelivery | null> {
    const record = await this.prisma.notificationDelivery.findUnique({ where: { idempotencyKey } });
    return record ? toDelivery(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: NotificationDeliveryListFilter,
  ): Promise<Page<NotificationDelivery>> {
    const where: Prisma.NotificationDeliveryWhereInput = {
      organizationId: tenantId,
      ...(filter?.templateId ? { templateId: filter.templateId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.channel ? { channel: filter.channel } : {}),
      ...(filter?.recipient ? { recipient: filter.recipient } : {}),
    };
    return paginate(
      page,
      () => this.prisma.notificationDelivery.count({ where }),
      () =>
        this.prisma.notificationDelivery.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toDelivery,
    );
  }

  async claim(
    tenantId: string,
    deliveryId: NotificationDeliveryId,
    now: Date,
  ): Promise<NotificationDelivery | null> {
    const updated = await this.prisma.notificationDelivery.updateMany({
      where: {
        id: deliveryId,
        organizationId: tenantId,
        status: 'pending',
        runAfter: { lte: now },
      },
      data: {
        status: 'sending',
        claimedAt: now,
        attempt: { increment: 1 },
        updatedAt: now,
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    const record = await this.prisma.notificationDelivery.findFirst({
      where: { id: deliveryId, organizationId: tenantId },
    });
    return record ? toDelivery(record) : null;
  }

  async listDue(now: Date, limit: number): Promise<NotificationDelivery[]> {
    const records = await this.prisma.notificationDelivery.findMany({
      where: { status: 'pending', runAfter: { lte: now } },
      orderBy: { runAfter: 'asc' },
      take: limit,
    });
    return records.map(toDelivery);
  }

  async reclaimStale(now: Date, staleAfterMs: number, limit: number): Promise<NotificationDelivery[]> {
    const cutoff = new Date(now.getTime() - staleAfterMs);
    const records = await this.prisma.notificationDelivery.findMany({
      where: { status: 'sending', claimedAt: { lte: cutoff } },
      take: limit,
    });
    const reclaimed: NotificationDelivery[] = [];
    for (const record of records) {
      const updated = await this.prisma.notificationDelivery.updateMany({
        where: { id: record.id, status: 'sending' },
        data: { status: 'pending', claimedAt: null, runAfter: now, updatedAt: now },
      });
      if (updated.count !== 1) {
        continue;
      }
      const fresh = await this.prisma.notificationDelivery.findUnique({ where: { id: record.id } });
      if (fresh) {
        reclaimed.push(toDelivery(fresh));
      }
    }
    return reclaimed;
  }
}

export class PostgresNotificationAttemptRepository implements NotificationAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(attempt: NotificationDeliveryAttempt): Promise<void> {
    const snapshot = attempt.toSnapshot();
    const data = toAttemptRecord(snapshot);
    await this.prisma.notificationDeliveryAttempt.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        provider: data.provider,
        providerMessageId: data.providerMessageId,
        message: data.message,
        finishedAt: data.finishedAt,
      },
    });
  }

  async findById(
    tenantId: string,
    attemptId: NotificationAttemptId,
  ): Promise<NotificationDeliveryAttempt | null> {
    const record = await this.prisma.notificationDeliveryAttempt.findFirst({
      where: { id: attemptId, organizationId: tenantId },
    });
    return record ? toAttempt(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: NotificationAttemptListFilter,
  ): Promise<Page<NotificationDeliveryAttempt>> {
    const where: Prisma.NotificationDeliveryAttemptWhereInput = {
      organizationId: tenantId,
      ...(filter?.deliveryId ? { deliveryId: filter.deliveryId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    };
    return paginate(
      page,
      () => this.prisma.notificationDeliveryAttempt.count({ where }),
      () =>
        this.prisma.notificationDeliveryAttempt.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toAttempt,
    );
  }
}

export class PostgresNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(preference: NotificationPreference): Promise<void> {
    const snapshot = preference.toSnapshot();
    const data = toPreferenceRecord(snapshot);
    await this.prisma.notificationPreference.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        enabled: data.enabled,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(
    tenantId: string,
    preferenceId: NotificationPreferenceId,
  ): Promise<NotificationPreference | null> {
    const record = await this.prisma.notificationPreference.findFirst({
      where: { id: preferenceId, organizationId: tenantId },
    });
    return record ? toPreference(record) : null;
  }

  async findBySubjectEventChannel(input: {
    readonly tenantId: string;
    readonly subjectType: string;
    readonly subjectKey: string;
    readonly eventType: string;
    readonly channel: string;
  }): Promise<NotificationPreference | null> {
    const record = await this.prisma.notificationPreference.findFirst({
      where: {
        organizationId: input.tenantId,
        subjectType: input.subjectType,
        subjectKey: input.subjectKey,
        eventType: input.eventType,
        channel: input.channel,
      },
    });
    return record ? toPreference(record) : null;
  }

  async listBySubject(input: {
    readonly tenantId: string;
    readonly subjectType: string;
    readonly subjectKey: string;
  }): Promise<NotificationPreference[]> {
    const records = await this.prisma.notificationPreference.findMany({
      where: {
        organizationId: input.tenantId,
        subjectType: input.subjectType,
        subjectKey: input.subjectKey,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return records.map(toPreference);
  }

  async countBySubject(input: {
    readonly tenantId: string;
    readonly subjectType: string;
    readonly subjectKey: string;
  }): Promise<number> {
    return this.prisma.notificationPreference.count({
      where: {
        organizationId: input.tenantId,
        subjectType: input.subjectType,
        subjectKey: input.subjectKey,
      },
    });
  }
}

export class PostgresNotificationInboxRepository implements NotificationInboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(item: NotificationInboxItem): Promise<void> {
    const snapshot = item.toSnapshot();
    const data = toInboxRecord(snapshot);
    await this.prisma.notificationInboxItem.upsert({
      where: { id: snapshot.id },
      create: data,
      update: { readAt: data.readAt },
    });
  }

  async findById(
    tenantId: string,
    userId: string,
    itemId: NotificationInboxItemId,
  ): Promise<NotificationInboxItem | null> {
    const record = await this.prisma.notificationInboxItem.findFirst({
      where: { id: itemId, organizationId: tenantId, userId },
    });
    return record ? toInbox(record) : null;
  }

  async listByUser(
    tenantId: string,
    userId: string,
    page: PageRequest,
    filter?: NotificationInboxListFilter,
  ): Promise<Page<NotificationInboxItem>> {
    const where: Prisma.NotificationInboxItemWhereInput = {
      organizationId: tenantId,
      userId,
      ...(filter?.unreadOnly ? { readAt: null } : {}),
    };
    return paginate(
      page,
      () => this.prisma.notificationInboxItem.count({ where }),
      () =>
        this.prisma.notificationInboxItem.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toInbox,
    );
  }

  async countUnread(tenantId: string, userId: string): Promise<number> {
    return this.prisma.notificationInboxItem.count({
      where: { organizationId: tenantId, userId, readAt: null },
    });
  }

  async markAllRead(tenantId: string, userId: string, now: Date): Promise<number> {
    const result = await this.prisma.notificationInboxItem.updateMany({
      where: { organizationId: tenantId, userId, readAt: null },
      data: { readAt: now },
    });
    return result.count;
  }
}

function skip(page: PageRequest): number {
  return (page.page - 1) * page.pageSize;
}

async function paginate<TRecord, TEntity>(
  page: PageRequest,
  count: () => Promise<number>,
  load: () => Promise<TRecord[]>,
  map: (record: TRecord) => TEntity,
): Promise<Page<TEntity>> {
  const [total, records] = await Promise.all([count(), load()]);
  return {
    items: records.map(map),
    total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

function toTemplateRecord(snapshot: NotificationTemplateSnapshot) {
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
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toDeliveryRecord(snapshot: NotificationDeliverySnapshot) {
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
    payload: snapshot.payload as Prisma.InputJsonValue,
    status: snapshot.status,
    attempt: snapshot.attempt,
    maxAttempts: snapshot.maxAttempts,
    runAfter: snapshot.runAfter,
    lastError: snapshot.lastError ?? null,
    provider: snapshot.provider ?? null,
    providerMessageId: snapshot.providerMessageId ?? null,
    claimedAt: snapshot.claimedAt ?? null,
    deliveredAt: snapshot.deliveredAt ?? null,
    completedAt: snapshot.completedAt ?? null,
    createdByUserId: snapshot.createdByUserId ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toAttemptRecord(snapshot: NotificationAttemptSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    deliveryId: snapshot.deliveryId,
    attempt: snapshot.attempt,
    status: snapshot.status,
    provider: snapshot.provider ?? null,
    providerMessageId: snapshot.providerMessageId ?? null,
    message: snapshot.message ?? null,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt ?? null,
  };
}

function toPreferenceRecord(snapshot: NotificationPreferenceSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subjectType: snapshot.subjectType,
    subjectKey: snapshot.subjectKey,
    eventType: snapshot.eventType,
    channel: snapshot.channel,
    enabled: snapshot.enabled,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toInboxRecord(snapshot: NotificationInboxItemSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    userId: snapshot.userId,
    deliveryId: snapshot.deliveryId,
    eventType: snapshot.eventType,
    title: snapshot.title,
    body: snapshot.body,
    readAt: snapshot.readAt ?? null,
    createdAt: snapshot.createdAt,
  };
}

function toTemplate(record: {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  channel: string;
  eventType: string;
  subject: string | null;
  body: string;
  recipientType: string;
  recipientField: string | null;
  enabled: boolean;
  maxAttempts: number;
  backoffMs: number;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): NotificationTemplate {
  const snapshot: NotificationTemplateSnapshot = {
    id: createNotificationTemplateId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    slug: record.slug,
    channel: parseChannel(record.channel),
    eventType: parseEventType(record.eventType),
    subject: record.subject ?? undefined,
    body: record.body,
    recipientType: parseRecipientType(record.recipientType),
    recipientField: record.recipientField ?? undefined,
    enabled: record.enabled,
    maxAttempts: record.maxAttempts,
    backoffMs: record.backoffMs,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return NotificationTemplate.reconstitute(snapshot);
}

function toDelivery(record: {
  id: string;
  organizationId: string;
  templateId: string | null;
  channel: string;
  eventType: string;
  eventId: string | null;
  triggerKind: string;
  idempotencyKey: string;
  recipientType: string;
  recipient: string;
  subject: string | null;
  body: string;
  payload: Prisma.JsonValue;
  status: string;
  attempt: number;
  maxAttempts: number;
  runAfter: Date;
  lastError: string | null;
  provider: string | null;
  providerMessageId: string | null;
  claimedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationDelivery {
  const snapshot: NotificationDeliverySnapshot = {
    id: createNotificationDeliveryId(record.id),
    organizationId: record.organizationId,
    templateId: record.templateId ? createNotificationTemplateId(record.templateId) : undefined,
    channel: parseChannel(record.channel),
    eventType: parseEventType(record.eventType),
    eventId: record.eventId ?? undefined,
    triggerKind: parseTriggerKind(record.triggerKind),
    idempotencyKey: record.idempotencyKey,
    recipientType: parseRecipientType(record.recipientType),
    recipient: record.recipient,
    subject: record.subject ?? undefined,
    body: record.body,
    payload: payloadRecord(record.payload),
    status: parseDeliveryStatus(record.status),
    attempt: record.attempt,
    maxAttempts: record.maxAttempts,
    runAfter: record.runAfter,
    lastError: record.lastError ?? undefined,
    provider: parseProviderName(record.provider ?? undefined),
    providerMessageId: record.providerMessageId ?? undefined,
    claimedAt: record.claimedAt ?? undefined,
    deliveredAt: record.deliveredAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    createdByUserId: record.createdByUserId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return NotificationDelivery.reconstitute(snapshot);
}

function toAttempt(record: {
  id: string;
  organizationId: string;
  deliveryId: string;
  attempt: number;
  status: string;
  provider: string | null;
  providerMessageId: string | null;
  message: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): NotificationDeliveryAttempt {
  const snapshot: NotificationAttemptSnapshot = {
    id: createNotificationAttemptId(record.id),
    organizationId: record.organizationId,
    deliveryId: createNotificationDeliveryId(record.deliveryId),
    attempt: record.attempt,
    status: parseAttemptStatus(record.status),
    provider: parseProviderName(record.provider ?? undefined),
    providerMessageId: record.providerMessageId ?? undefined,
    message: record.message ?? undefined,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt ?? undefined,
  };
  return NotificationDeliveryAttempt.reconstitute(snapshot);
}

function toPreference(record: {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectKey: string;
  eventType: string;
  channel: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NotificationPreference {
  const snapshot: NotificationPreferenceSnapshot = {
    id: createNotificationPreferenceId(record.id),
    organizationId: record.organizationId,
    subjectType: parsePreferenceSubjectType(record.subjectType),
    subjectKey: record.subjectKey,
    eventType: record.eventType,
    channel: parseChannel(record.channel),
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return NotificationPreference.reconstitute(snapshot);
}

function toInbox(record: {
  id: string;
  organizationId: string;
  userId: string;
  deliveryId: string;
  eventType: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationInboxItem {
  const snapshot: NotificationInboxItemSnapshot = {
    id: createNotificationInboxItemId(record.id),
    organizationId: record.organizationId,
    userId: record.userId,
    deliveryId: createNotificationDeliveryId(record.deliveryId),
    eventType: parseEventType(record.eventType),
    title: record.title,
    body: record.body,
    readAt: record.readAt ?? undefined,
    createdAt: record.createdAt,
  };
  return NotificationInboxItem.reconstitute(snapshot);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
