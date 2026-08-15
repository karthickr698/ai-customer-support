import type { Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { DISPATCH_BATCH_SIZE, STALE_SENDING_MS } from '../../domain/notification-policy.js';
import { NOTIFICATION_DELIVER_QUEUE, type NotificationDeliverJob } from '../queues.js';
import type { ClockPort, NotificationDeliveryRepository } from '../ports.js';

export class DispatchDueNotificationsUseCase {
  constructor(
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly logger: Logger,
  ) {}

  async execute(limit = DISPATCH_BATCH_SIZE): Promise<number> {
    const now = this.clock.now();
    const due = await this.deliveries.listDue(now, limit);
    const stale = await this.deliveries.reclaimStale(now, STALE_SENDING_MS, limit);
    const batch = [...due, ...stale];
    let enqueued = 0;
    const seen = new Set<string>();
    for (const delivery of batch) {
      if (seen.has(delivery.id) || delivery.isTerminal()) {
        continue;
      }
      seen.add(delivery.id);
      await this.queue.enqueue<NotificationDeliverJob>(NOTIFICATION_DELIVER_QUEUE, {
        tenantId: delivery.organizationId,
        deliveryId: delivery.id,
      });
      enqueued += 1;
    }
    if (enqueued > 0) {
      this.logger.info('Dispatched due notification deliveries', { enqueued });
    }
    return enqueued;
  }
}
