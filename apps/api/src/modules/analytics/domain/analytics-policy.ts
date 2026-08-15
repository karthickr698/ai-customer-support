import { InsufficientAnalyticsPermissionError } from './errors.js';

export class AnalyticsPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientAnalyticsPermissionError(permission);
    }
  }
}

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
export const MAX_HOUR_RANGE_DAYS = 14;
export const MAX_TOP_CUSTOMERS = 50;
export const MAX_TAG_BREAKDOWN = 50;
export const MAX_AGENTS = 200;
