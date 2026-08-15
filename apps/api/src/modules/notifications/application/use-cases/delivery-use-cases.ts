import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import type {
  DispatchNotificationsResponse,
  NotificationAttemptListResponse,
  NotificationDeliveryListResponse,
  NotificationDeliveryResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  InvalidNotificationError,
  NotificationDeliveryNotFoundError,
} from '../../domain/errors.js';
import { createNotificationDeliveryId, createNotificationTemplateId } from '../../domain/ids.js';
import { NotificationPolicy } from '../../domain/notification-policy.js';
import { isUuid, parseChannel, parseDeliveryStatus } from '../../domain/values.js';
import { toAttemptDto, toDeliveryDto } from '../dtos.js';
import { NOTIFICATION_DELIVER_QUEUE, type NotificationDeliverJob } from '../queues.js';
import type {
  ClockPort,
  NotificationAttemptRepository,
  NotificationDeliveryRepository,
  TenantAccessPort,
} from '../ports.js';
import { DispatchDueNotificationsUseCase } from './dispatch-due-notifications-use-case.js';

export class GetNotificationDeliveryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly deliveries: NotificationDeliveryRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly deliveryId: string;
  }): Promise<NotificationDeliveryResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    const delivery = await loadDelivery(this.deliveries, actor.tenantId, input.deliveryId);
    return { delivery: toDeliveryDto(delivery) };
  }
}

export class ListNotificationDeliveriesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly deliveries: NotificationDeliveryRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly templateId?: string;
    readonly status?: string;
    readonly channel?: string;
    readonly recipient?: string;
  }): Promise<NotificationDeliveryListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    if (input.templateId && !isUuid(input.templateId)) {
      throw new InvalidNotificationError('templateId must be a UUID');
    }
    const result = await this.deliveries.listByTenant(actor.tenantId, input.page, {
      templateId: input.templateId ? createNotificationTemplateId(input.templateId) : undefined,
      status: input.status ? parseDeliveryStatus(input.status) : undefined,
      channel: input.channel ? parseChannel(input.channel) : undefined,
      recipient: input.recipient,
    });
    return {
      items: result.items.filter((delivery) => delivery.belongsTo(actor.tenantId)).map(toDeliveryDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class RetryNotificationDeliveryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly deliveryId: string;
  }): Promise<NotificationDeliveryResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    const delivery = await loadDelivery(this.deliveries, actor.tenantId, input.deliveryId);
    delivery.scheduleRetry(this.clock.now());
    await this.deliveries.save(delivery);
    await this.queue.enqueue<NotificationDeliverJob>(NOTIFICATION_DELIVER_QUEUE, {
      tenantId: actor.tenantId,
      deliveryId: delivery.id,
    });
    return { delivery: toDeliveryDto(delivery) };
  }
}

export class ListNotificationAttemptsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly attempts: NotificationAttemptRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly deliveryId?: string;
    readonly status?: string;
  }): Promise<NotificationAttemptListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    if (input.deliveryId && !isUuid(input.deliveryId)) {
      throw new InvalidNotificationError('deliveryId must be a UUID');
    }
    const result = await this.attempts.listByTenant(actor.tenantId, input.page, {
      deliveryId: input.deliveryId ? createNotificationDeliveryId(input.deliveryId) : undefined,
      status: input.status,
    });
    return {
      items: result.items.map(toAttemptDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class DispatchNotificationsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly dispatchDue: DispatchDueNotificationsUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<DispatchNotificationsResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    const enqueued = await this.dispatchDue.execute();
    return { enqueued };
  }
}

async function loadDelivery(
  deliveries: NotificationDeliveryRepository,
  tenantId: string,
  deliveryId: string,
): Promise<import('../../domain/notification-delivery.js').NotificationDelivery> {
  if (!isUuid(deliveryId)) {
    throw new InvalidNotificationError('deliveryId must be a UUID');
  }
  const delivery = await deliveries.findById(tenantId, createNotificationDeliveryId(deliveryId));
  if (!delivery || !delivery.belongsTo(tenantId)) {
    throw new NotificationDeliveryNotFoundError();
  }
  return delivery;
}
