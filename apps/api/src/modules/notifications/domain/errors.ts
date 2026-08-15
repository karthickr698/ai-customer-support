import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientNotificationPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidNotificationError extends DomainError {
  readonly code = 'INVALID_NOTIFICATION';

  constructor(message: string) {
    super(message, 400);
  }
}

export class InvalidNotificationStateError extends DomainError {
  readonly code = 'INVALID_NOTIFICATION_STATE';

  constructor(message: string) {
    super(message, 400);
  }
}

export class NotificationTemplateNotFoundError extends DomainError {
  readonly code = 'NOTIFICATION_TEMPLATE_NOT_FOUND';

  constructor() {
    super('Notification template not found', 404);
  }
}

export class NotificationDeliveryNotFoundError extends DomainError {
  readonly code = 'NOTIFICATION_DELIVERY_NOT_FOUND';

  constructor() {
    super('Notification delivery not found', 404);
  }
}

export class NotificationInboxItemNotFoundError extends DomainError {
  readonly code = 'NOTIFICATION_INBOX_ITEM_NOT_FOUND';

  constructor() {
    super('Inbox notification not found', 404);
  }
}

export class DuplicateNotificationTemplateError extends DomainError {
  readonly code = 'DUPLICATE_NOTIFICATION_TEMPLATE';

  constructor() {
    super('A notification template with that slug already exists', 409);
  }
}

export class DuplicateNotificationDeliveryError extends DomainError {
  readonly code = 'DUPLICATE_NOTIFICATION_DELIVERY';

  constructor() {
    super('A notification delivery with that idempotency key already exists', 409);
  }
}

export class TooManyNotificationRecordsError extends DomainError {
  readonly code = 'TOO_MANY_NOTIFICATION_RECORDS';

  constructor(resource: string) {
    super(`This organization already has the maximum number of ${resource}`, 409);
  }
}

export class UnsafeNotificationUrlError extends DomainError {
  readonly code = 'UNSAFE_NOTIFICATION_URL';

  constructor(message: string) {
    super(message, 400);
  }
}

export class NotificationProviderError extends DomainError {
  readonly code = 'NOTIFICATION_PROVIDER_FAILED';

  constructor(message: string) {
    super(message, 502);
  }
}
