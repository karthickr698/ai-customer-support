import type { EventBus, Logger } from '@ai-customer-support/shared';
import { NotificationProviderError } from '../../domain/errors.js';
import {
  NotificationDeliveredEvent,
  NotificationFailedEvent,
  NotificationSkippedEvent,
} from '../../domain/events.js';
import { createNotificationDeliveryId } from '../../domain/ids.js';
import { NotificationDeliveryAttempt } from '../../domain/notification-attempt.js';
import { isChannelOptedIn } from '../../domain/notification-preference.js';
import { isUuid, preferenceSubjectForRecipient } from '../../domain/values.js';
import type { NotificationDeliverJob } from '../queues.js';
import type {
  ClockPort,
  NotificationAttemptRepository,
  NotificationDeliveryRepository,
  NotificationPreferenceRepository,
  NotificationProviderRegistry,
  NotificationTemplateRepository,
} from '../ports.js';

export class DeliverNotificationUseCase {
  constructor(
    private readonly templates: NotificationTemplateRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly attempts: NotificationAttemptRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly providers: NotificationProviderRegistry,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async execute(message: NotificationDeliverJob): Promise<void> {
    if (!isUuid(message.deliveryId) || !message.tenantId) {
      return;
    }
    const claimed = await this.deliveries.claim(
      message.tenantId,
      createNotificationDeliveryId(message.deliveryId),
      this.clock.now(),
    );
    if (!claimed) {
      return;
    }
    const attempt = NotificationDeliveryAttempt.start({
      organizationId: claimed.organizationId,
      deliveryId: claimed.id,
      attempt: claimed.attempt,
      now: this.clock.now(),
    });
    await this.attempts.save(attempt);

    if (claimed.templateId) {
      const template = await this.templates.findById(claimed.organizationId, claimed.templateId);
      if (!template || !template.belongsTo(claimed.organizationId) || !template.enabled) {
        await this.finishSkipped(claimed, attempt, 'Template is missing or disabled');
        return;
      }
    }

    const optedIn = await this.isOptedIn(claimed.organizationId, claimed);
    if (!optedIn) {
      await this.finishSkipped(claimed, attempt, 'Recipient opted out');
      return;
    }

    try {
      const provider = this.providers.resolve(claimed.channel);
      const result = await provider.send({
        tenantId: claimed.organizationId,
        deliveryId: claimed.id,
        channel: claimed.channel,
        eventType: claimed.eventType,
        recipientType: claimed.recipientType,
        recipient: claimed.recipient,
        subject: claimed.subject,
        body: claimed.body,
        payload: claimed.payload,
      });
      if (!result.ok) {
        throw new NotificationProviderError(result.error ?? 'Provider rejected the message');
      }
      const now = this.clock.now();
      claimed.markDelivered({
        now,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
      });
      attempt.finish({
        status: 'delivered',
        now,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
      });
      await this.deliveries.save(claimed);
      await this.attempts.save(attempt);
      await this.eventBus.publish(
        new NotificationDeliveredEvent(
          crypto.randomUUID(),
          now,
          claimed.organizationId,
          claimed.id,
          claimed.channel,
          claimed.attempt,
          result.provider,
        ),
      );
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : 'Notification delivery failed';
      const now = this.clock.now();
      const backoffMs = claimed.templateId
        ? ((await this.templates.findById(claimed.organizationId, claimed.templateId))?.backoffMs ?? 2_000)
        : 2_000;
      claimed.markFailed({ now, error: messageText, backoffMs });
      attempt.finish({ status: 'failed', now, message: messageText });
      await this.deliveries.save(claimed);
      await this.attempts.save(attempt);
      await this.eventBus.publish(
        new NotificationFailedEvent(
          crypto.randomUUID(),
          now,
          claimed.organizationId,
          claimed.id,
          claimed.channel,
          claimed.attempt,
          claimed.status === 'dead',
        ),
      );
      this.logger.warn('Notification delivery failed', {
        tenantId: claimed.organizationId,
        deliveryId: claimed.id,
        attempt: claimed.attempt,
        status: claimed.status,
        message: messageText,
      });
    }
  }

  private async finishSkipped(
    delivery: import('../../domain/notification-delivery.js').NotificationDelivery,
    attempt: NotificationDeliveryAttempt,
    reason: string,
  ): Promise<void> {
    const now = this.clock.now();
    delivery.markSkipped(now, reason);
    attempt.finish({ status: 'skipped', now, message: reason });
    await this.deliveries.save(delivery);
    await this.attempts.save(attempt);
    await this.eventBus.publish(
      new NotificationSkippedEvent(crypto.randomUUID(), now, delivery.organizationId, delivery.id, reason),
    );
  }

  private async isOptedIn(
    tenantId: string,
    delivery: import('../../domain/notification-delivery.js').NotificationDelivery,
  ): Promise<boolean> {
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
