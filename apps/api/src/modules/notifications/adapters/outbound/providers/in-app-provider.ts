import { NotificationInboxItem } from '../../../domain/notification-inbox-item.js';
import { createNotificationDeliveryId } from '../../../domain/ids.js';
import type {
  ClockPort,
  NotificationInboxRepository,
  NotificationProviderPort,
  ProviderMessage,
  ProviderResult,
} from '../../../application/ports.js';

export class InAppNotificationProvider implements NotificationProviderPort {
  readonly name = 'in_app' as const;
  readonly channel = 'in_app' as const;

  constructor(
    private readonly inbox: NotificationInboxRepository,
    private readonly clock: ClockPort,
  ) {}

  async send(message: ProviderMessage): Promise<ProviderResult> {
    const item = NotificationInboxItem.create({
      organizationId: message.tenantId,
      userId: message.recipient,
      deliveryId: createNotificationDeliveryId(message.deliveryId),
      eventType: message.eventType,
      title: message.subject?.trim() || 'Notification',
      body: message.body,
      now: this.clock.now(),
    });
    await this.inbox.save(item);
    return { ok: true, provider: this.name, providerMessageId: item.id };
  }
}
