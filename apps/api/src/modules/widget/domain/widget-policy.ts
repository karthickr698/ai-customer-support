import { InsufficientWidgetPermissionError, WidgetOriginNotAllowedError } from './errors.js';

export class WidgetPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientWidgetPermissionError(permission);
    }
  }

  static assertOriginAllowed(allowedOrigins: readonly string[], origin: string | undefined): void {
    if (allowedOrigins.length === 0) {
      return;
    }

    if (!origin || !allowedOrigins.includes(origin)) {
      throw new WidgetOriginNotAllowedError();
    }
  }
}
