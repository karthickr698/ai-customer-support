import { InsufficientNotificationPermissionError } from './errors.js';

export class NotificationPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientNotificationPermissionError(permission);
    }
  }
}

export const MAX_TEMPLATES_PER_TENANT = 100;
export const MAX_PREFERENCES_PER_SUBJECT = 40;
export const MAX_BODY_LENGTH = 20_000;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_LOG_MESSAGE = 2_000;
export const DISPATCH_INTERVAL_MS = 5_000;
export const DISPATCH_BATCH_SIZE = 50;
export const STALE_SENDING_MS = 5 * 60_000;
export const NOTIFICATION_DELIVER_QUEUE = 'notification.deliver';
export const ALL_EVENTS_PREFERENCE = '*';
