import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientWidgetPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission
        ? `Missing permission: ${permission}`
        : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class WidgetNotFoundError extends DomainError {
  readonly code = 'WIDGET_NOT_FOUND';

  constructor() {
    super('Widget configuration not found', 404);
  }
}

export class WidgetDisabledError extends DomainError {
  readonly code = 'WIDGET_DISABLED';

  constructor() {
    super('This support widget is currently disabled', 403);
  }
}

export class WidgetOriginNotAllowedError extends DomainError {
  readonly code = 'WIDGET_ORIGIN_NOT_ALLOWED';

  constructor() {
    super('This origin is not allowed to use the widget', 403);
  }
}

export class WidgetSessionNotFoundError extends DomainError {
  readonly code = 'WIDGET_SESSION_NOT_FOUND';

  constructor() {
    super('Widget session not found', 401);
  }
}

export class WidgetSessionExpiredError extends DomainError {
  readonly code = 'WIDGET_SESSION_EXPIRED';

  constructor() {
    super('Widget session has expired. Start a new session.', 401);
  }
}

export class AnonymousSessionsNotAllowedError extends DomainError {
  readonly code = 'ANONYMOUS_SESSIONS_NOT_ALLOWED';

  constructor() {
    super('This widget requires a customer name and email', 400);
  }
}

export class InvalidWidgetConfigurationError extends DomainError {
  readonly code = 'INVALID_WIDGET_CONFIGURATION';

  constructor(message: string) {
    super(message, 400);
  }
}

export class InvalidWidgetSessionError extends DomainError {
  readonly code = 'INVALID_WIDGET_SESSION';

  constructor(message = 'Widget session is invalid') {
    super(message, 400);
  }
}
