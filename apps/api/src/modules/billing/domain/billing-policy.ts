import { InsufficientBillingPermissionError } from './errors.js';

export class BillingPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientBillingPermissionError(permission);
    }
  }
}

export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_PLAN_SLUG = 'free';
export const CHECKOUT_TTL_MS = 30 * 60_000;
export const INVOICE_DUE_DAYS = 7;
export const RENEWAL_INTERVAL_MS = 30_000;
export const RENEWAL_BATCH_SIZE = 50;
export const MAX_FEATURES = 20;
export const MAX_FEATURE_LENGTH = 80;
export const CONSUMING_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due']);
export const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'past_due']);
