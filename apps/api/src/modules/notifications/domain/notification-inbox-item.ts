import type { NotificationEventType } from '@ai-customer-support/contracts';
import { InvalidNotificationError } from './errors.js';
import {
  createNotificationInboxItemId,
  type NotificationDeliveryId,
  type NotificationInboxItemId,
} from './ids.js';
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from './notification-policy.js';
import { isUuid, normalizeText, parseEventType, requireUuid } from './values.js';

export type NotificationInboxItemSnapshot = {
  readonly id: NotificationInboxItemId;
  readonly organizationId: string;
  readonly userId: string;
  readonly deliveryId: NotificationDeliveryId;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly readAt: Date | undefined;
  readonly createdAt: Date;
};

export class NotificationInboxItem {
  private constructor(
    readonly id: NotificationInboxItemId,
    readonly organizationId: string,
    readonly userId: string,
    readonly deliveryId: NotificationDeliveryId,
    readonly eventType: NotificationEventType,
    readonly title: string,
    readonly body: string,
    private readAtValue: Date | undefined,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly deliveryId: NotificationDeliveryId;
    readonly eventType: string;
    readonly title: string;
    readonly body: string;
    readonly now: Date;
    readonly id?: NotificationInboxItemId;
  }): NotificationInboxItem {
    if (!input.organizationId.trim()) {
      throw new InvalidNotificationError('Organization is required');
    }
    return new NotificationInboxItem(
      input.id ?? createNotificationInboxItemId(),
      input.organizationId,
      requireUuid(input.userId, 'User'),
      input.deliveryId,
      parseEventType(input.eventType),
      normalizeText(input.title, 'Title', 1, MAX_SUBJECT_LENGTH),
      normalizeText(input.body, 'Body', 1, MAX_BODY_LENGTH),
      undefined,
      input.now,
    );
  }

  static reconstitute(snapshot: NotificationInboxItemSnapshot): NotificationInboxItem {
    return new NotificationInboxItem(
      snapshot.id,
      snapshot.organizationId,
      snapshot.userId,
      snapshot.deliveryId,
      snapshot.eventType,
      snapshot.title,
      snapshot.body,
      snapshot.readAt,
      snapshot.createdAt,
    );
  }

  get readAt(): Date | undefined {
    return this.readAtValue;
  }

  get unread(): boolean {
    return this.readAtValue === undefined;
  }

  belongsTo(tenantId: string, userId?: string): boolean {
    if (this.organizationId !== tenantId) {
      return false;
    }
    return userId === undefined || this.userId === userId;
  }

  markRead(now: Date): void {
    if (!this.readAtValue) {
      this.readAtValue = now;
    }
  }

  toSnapshot(): NotificationInboxItemSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      deliveryId: this.deliveryId,
      eventType: this.eventType,
      title: this.title,
      body: this.body,
      readAt: this.readAtValue,
      createdAt: this.createdAt,
    };
  }
}

export function isInboxUserId(value: string): boolean {
  return isUuid(value);
}
