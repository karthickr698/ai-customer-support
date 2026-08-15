import type {
  NotificationInboxItemResponse,
  NotificationInboxListResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { InvalidNotificationError, NotificationInboxItemNotFoundError } from '../../domain/errors.js';
import { createNotificationInboxItemId } from '../../domain/ids.js';
import { NotificationPolicy } from '../../domain/notification-policy.js';
import { isUuid } from '../../domain/values.js';
import { toInboxDto } from '../dtos.js';
import type { ClockPort, NotificationInboxRepository, TenantAccessPort } from '../ports.js';

export class ListNotificationInboxUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly inbox: NotificationInboxRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly unreadOnly?: boolean;
  }): Promise<NotificationInboxListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    const [result, unreadCount] = await Promise.all([
      this.inbox.listByUser(actor.tenantId, actor.actorId, input.page, {
        unreadOnly: input.unreadOnly,
      }),
      this.inbox.countUnread(actor.tenantId, actor.actorId),
    ]);
    return {
      items: result.items
        .filter((item) => item.belongsTo(actor.tenantId, actor.actorId))
        .map(toInboxDto),
      unreadCount,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class MarkInboxItemReadUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly inbox: NotificationInboxRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly itemId: string;
  }): Promise<NotificationInboxItemResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    if (!isUuid(input.itemId)) {
      throw new InvalidNotificationError('itemId must be a UUID');
    }
    const item = await this.inbox.findById(
      actor.tenantId,
      actor.actorId,
      createNotificationInboxItemId(input.itemId),
    );
    if (!item || !item.belongsTo(actor.tenantId, actor.actorId)) {
      throw new NotificationInboxItemNotFoundError();
    }
    item.markRead(this.clock.now());
    await this.inbox.save(item);
    return { item: toInboxDto(item) };
  }
}

export class MarkInboxReadAllUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly inbox: NotificationInboxRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<{ readonly updated: number }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    const updated = await this.inbox.markAllRead(actor.tenantId, actor.actorId, this.clock.now());
    return { updated };
  }
}
