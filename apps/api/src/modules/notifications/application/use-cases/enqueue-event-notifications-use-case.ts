import type { DomainEvent, EventBus, Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { NotificationRequestedEvent, NotificationSkippedEvent } from '../../domain/events.js';
import {
  eventIdempotencyKey,
  NotificationDelivery,
} from '../../domain/notification-delivery.js';
import { isChannelOptedIn } from '../../domain/notification-preference.js';
import { renderTemplate } from '../../domain/template-renderer.js';
import {
  normalizeRecipient,
  preferenceSubjectForRecipient,
  readPath,
} from '../../domain/values.js';
import { domainEventPayload, NOTIFICATION_DELIVER_QUEUE, type NotificationDeliverJob } from '../queues.js';
import type {
  ClockPort,
  NotificationDeliveryRepository,
  NotificationPreferenceRepository,
  NotificationTemplateRepository,
} from '../ports.js';

export class EnqueueEventNotificationsUseCase {
  constructor(
    private readonly templates: NotificationTemplateRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
    private readonly allowLocalHttp: boolean,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!event.tenantId) {
      return;
    }
    const payload = domainEventPayload(event);
    const templates = await this.templates.listEnabledByEvent(event.tenantId, event.eventName);
    const now = this.clock.now();
    for (const template of templates) {
      if (!template.matchesEvent(event.eventName) || !template.belongsTo(event.tenantId)) {
        continue;
      }
      const rawRecipient = template.recipientField
        ? readPath(payload, template.recipientField)
        : undefined;
      if (typeof rawRecipient !== 'string' || rawRecipient.trim().length === 0) {
        this.logger.warn('Notification template skipped; recipient field missing', {
          tenantId: event.tenantId,
          templateId: template.id,
          eventName: event.eventName,
          recipientField: template.recipientField,
        });
        continue;
      }
      let recipient: string;
      try {
        recipient = normalizeRecipient(template.recipientType, rawRecipient);
      } catch {
        this.logger.warn('Notification template skipped; recipient is invalid', {
          tenantId: event.tenantId,
          templateId: template.id,
          eventName: event.eventName,
        });
        continue;
      }
      const subject = renderTemplate(template.subject ?? '', payload) || undefined;
      const body = renderTemplate(template.body, payload);
      const delivery = NotificationDelivery.create({
        organizationId: event.tenantId,
        channel: template.channel,
        eventType: template.eventType,
        triggerKind: 'event',
        idempotencyKey: eventIdempotencyKey(event.tenantId, template.id, event.eventId, recipient),
        recipientType: template.recipientType,
        recipient,
        body,
        now,
        templateId: template.id,
        eventId: event.eventId,
        subject,
        payload,
        maxAttempts: template.maxAttempts,
        backoffMs: template.backoffMs,
        allowLocalHttp: this.allowLocalHttp,
      });
      const optedIn = await this.isOptedIn(event.tenantId, delivery);
      if (!optedIn) {
        delivery.markSkipped(now, 'Recipient opted out');
      }
      const created = await this.deliveries.tryInsert(delivery);
      if (!created) {
        continue;
      }
      if (delivery.status === 'pending') {
        await this.queue.enqueue<NotificationDeliverJob>(NOTIFICATION_DELIVER_QUEUE, {
          tenantId: event.tenantId,
          deliveryId: delivery.id,
        });
        await this.eventBus.publish(
          new NotificationRequestedEvent(
            crypto.randomUUID(),
            now,
            event.tenantId,
            delivery.id,
            delivery.channel,
            delivery.eventType,
            event.correlationId,
          ),
        );
        this.logger.info('Notification delivery enqueued', {
          tenantId: event.tenantId,
          templateId: template.id,
          deliveryId: delivery.id,
          eventName: event.eventName,
          eventId: event.eventId,
        });
      } else {
        await this.eventBus.publish(
          new NotificationSkippedEvent(
            crypto.randomUUID(),
            now,
            event.tenantId,
            delivery.id,
            delivery.lastError ?? 'Recipient opted out',
            event.correlationId,
          ),
        );
      }
    }
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
