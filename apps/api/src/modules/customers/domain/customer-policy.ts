import { InsufficientCustomerPermissionError } from './errors.js';

export class CustomerPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientCustomerPermissionError(permission);
    }
  }
}

export const MAX_CUSTOMERS_PER_TENANT = 10_000;
export const MAX_PRODUCTS_PER_TENANT = 10_000;
export const MAX_ORDERS_PER_TENANT = 50_000;
export const MAX_SHIPMENTS_PER_TENANT = 50_000;
export const MAX_RETURNS_PER_TENANT = 50_000;
export const MAX_ORDER_LINE_ITEMS = 50;
