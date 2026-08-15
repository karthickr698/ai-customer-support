import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import type { SendNotificationResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { InvalidNotificationError, NotificationTemplateNotFoundError } from '../../domain/errors.js';
import { createNotificationTemplateId } from '../../domain/ids.js';
import { NotificationRequestedEvent, NotificationSkippedEvent } from '../../domain/events.js';
import {
  manualIdempotencyKey,
  NotificationDelivery,
} from '../../domain/notification-delivery.js';
import { NotificationPolicy } from '../../domain/notification-policy.js';
import { isChannelOptedIn } from '../../domain/notification-preference.js';
import { renderTemplate } from '../../domain/template-renderer.js';
import {
  jsonRecord,
  normalizeRecipient,
  parseChannel,
  parseEventType,
  parseRecipientType,
  preferenceSubjectForRecipient,
} from '../../domain/values.js';
import { toDeliveryDto, type RequestSecurityContext } from '../dtos.js';
import { NOTIFICATION_DELIVER_QUEUE, type NotificationDeliverJob } from '../queues.js';
import type {
  ClockPort,
  NotificationDeliveryRepository,
  NotificationPreferenceRepository,
  NotificationTemplateRepository,
  TenantAccessPort,
} from '../ports.js';

export class SendNotificationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly templates: NotificationTemplateRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly allowLocalHttp: boolean,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly recipient: { readonly type: string; readonly address: string };
    readonly templateId?: string;
    readonly templateSlug?: string;
    readonly channel?: string;
    readonly eventType?: string;
    readonly subject?: string;
    readonly body?: string;
    readonly data?: Record<string, unknown>;
    readonly idempotencyKey?: string;
    readonly ignorePreferences?: boolean;
    readonly security: RequestSecurityContext;
  }): Promise<SendNotificationResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    const template = await this.resolveTemplate(actor.tenantId, input.templateId, input.templateSlug);
    const channel = parseChannel(input.channel ?? template?.channel ?? '');
    const eventType = parseEventType(input.eventType ?? template?.eventType ?? 'manual');
    const recipientType = parseRecipientType(input.recipient.type);
    const recipient = normalizeRecipient(recipientType, input.recipient.address);
    const payload = jsonRecord(input.data);
    const subject = renderTemplate(input.subject ?? template?.subject ?? '', payload) || undefined;
    const bodySource = input.body ?? template?.body;
    if (!bodySource) {
      throw new InvalidNotificationError('Body is required when no template is provided');
    }
    const body = renderTemplate(bodySource, payload);
    const now = this.clock.now();
    const key = (input.idempotencyKey?.trim() || input.security.requestId).slice(0, 80);
    const delivery = NotificationDelivery.create({
      organizationId: actor.tenantId,
      channel,
      eventType,
      triggerKind: 'manual',
      idempotencyKey: manualIdempotencyKey(
        actor.tenantId,
        template?.id ?? `adhoc:${channel}`,
        `${recipientType}:${recipient}`,
        key,
      ),
      recipientType,
      recipient,
      body,
      now,
      templateId: template?.id,
      subject,
      payload,
      maxAttempts: template?.maxAttempts,
      backoffMs: template?.backoffMs,
      createdByUserId: actor.actorId,
      allowLocalHttp: this.allowLocalHttp,
    });

    if (!input.ignorePreferences) {
      const optedIn = await this.isOptedIn(actor.tenantId, delivery);
      if (!optedIn) {
        delivery.markSkipped(now, 'Recipient opted out');
      }
    }

    const created = await this.deliveries.tryInsert(delivery);
    const stored = created
      ? delivery
      : await this.deliveries.findByIdempotencyKey(delivery.idempotencyKey);
    if (!stored || !stored.belongsTo(actor.tenantId)) {
      throw new InvalidNotificationError('Unable to enqueue notification');
    }
    if (created && stored.status === 'pending') {
      await this.queue.enqueue<NotificationDeliverJob>(NOTIFICATION_DELIVER_QUEUE, {
        tenantId: actor.tenantId,
        deliveryId: stored.id,
      });
      await this.eventBus.publish(
        new NotificationRequestedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          stored.id,
          stored.channel,
          stored.eventType,
          input.security.correlationId,
        ),
      );
    } else if (created && stored.status === 'skipped') {
      await this.eventBus.publish(
        new NotificationSkippedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          stored.id,
          stored.lastError ?? 'Recipient opted out',
          input.security.correlationId,
        ),
      );
    }
    return { delivery: toDeliveryDto(stored), created };
  }

  private async resolveTemplate(
    tenantId: string,
    templateId?: string,
    templateSlug?: string,
  ) {
    if (!templateId && !templateSlug) {
      return undefined;
    }
    if (templateId && templateSlug) {
      throw new InvalidNotificationError('Provide templateId or templateSlug, not both');
    }
    const template = templateId
      ? await this.templates.findById(tenantId, createNotificationTemplateId(templateId))
      : await this.templates.findBySlug(tenantId, (templateSlug ?? '').trim().toLowerCase());
    if (!template || !template.belongsTo(tenantId)) {
      throw new NotificationTemplateNotFoundError();
    }
    if (!template.enabled) {
      throw new InvalidNotificationError('Notification template is disabled');
    }
    return template;
  }

  private async isOptedIn(tenantId: string, delivery: NotificationDelivery): Promise<boolean> {
    const subject = preferenceSubjectForRecipient(delivery.recipientType, delivery.recipient);
    if (!subject) {
      return true;
    }
    const prefs = await this.preferences.listBySubject({
      tenantId,
      subjectType: subject.subjectType,
      subjectKey: subject.subjectKey,
    });
    return isChannelOptedIn(prefs, {
      subjectType: subject.subjectType,
      subjectKey: subject.subjectKey,
      eventType: delivery.eventType,
      channel: delivery.channel,
    });
  }
}
