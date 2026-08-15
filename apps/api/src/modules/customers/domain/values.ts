import type {
  CustomerStatus,
  OrderStatus,
  ProductStatus,
  ReturnStatus,
  ShipmentStatus,
} from '@ai-customer-support/contracts';
import {
  CUSTOMER_STATUSES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  RETURN_STATUSES,
  SHIPMENT_STATUSES,
} from '@ai-customer-support/contracts';
import {
  InvalidCustomerRecordError,
  InvalidOrderError,
  InvalidProductError,
  InvalidReturnError,
  InvalidShipmentError,
} from './errors.js';

export function parseCustomerStatus(value: string | undefined): CustomerStatus {
  const status = (value ?? 'active').trim();
  if (!(CUSTOMER_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidCustomerRecordError('Customer status must be active or disabled');
  }
  return status as CustomerStatus;
}

export function parseProductStatus(value: string | undefined): ProductStatus {
  const status = (value ?? 'active').trim();
  if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidProductError('Product status must be draft, active, or archived');
  }
  return status as ProductStatus;
}

export function parseOrderStatus(value: string | undefined): OrderStatus {
  const status = (value ?? 'paid').trim();
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidOrderError('Order status is invalid');
  }
  return status as OrderStatus;
}

export function parseShipmentStatus(value: string | undefined): ShipmentStatus {
  const status = (value ?? 'pending').trim();
  if (!(SHIPMENT_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidShipmentError('Shipment status is invalid');
  }
  return status as ShipmentStatus;
}

export function parseReturnStatus(value: string | undefined): ReturnStatus {
  const status = (value ?? 'requested').trim();
  if (!(RETURN_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidReturnError('Return status is invalid');
  }
  return status as ReturnStatus;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new InvalidCustomerRecordError('Enter a valid customer email address');
  }
  return email;
}

export function normalizeName(raw: string, label: string, max = 80): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > max) {
    throw new InvalidCustomerRecordError(`${label} must be between 1 and ${max} characters`);
  }
  return name;
}

export function normalizeOptionalPhone(raw: string | undefined): string | undefined {
  const phone = raw?.trim();
  if (!phone) {
    return undefined;
  }
  if (phone.length > 32) {
    throw new InvalidCustomerRecordError('Phone must be at most 32 characters');
  }
  return phone;
}

export function normalizeSku(raw: string): string {
  const sku = raw.trim();
  if (!SKU_PATTERN.test(sku)) {
    throw new InvalidProductError('SKU must be 1-80 letters, numbers, dots, underscores, or hyphens');
  }
  return sku;
}

export function normalizeCurrency(raw: string | undefined): string {
  const currency = (raw ?? 'USD').trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new InvalidProductError('Currency must be a 3-letter ISO code');
  }
  return currency;
}

export function normalizeMoney(raw: number, label: string): number {
  if (!Number.isInteger(raw) || raw < 0 || raw > 1_000_000_000) {
    throw new InvalidProductError(`${label} must be an integer from 0 to 1000000000`);
  }
  return raw;
}

export function normalizeExternalId(raw: string, label: string): string {
  const value = raw.trim();
  if (value.length < 1 || value.length > 80) {
    throw new InvalidOrderError(`${label} must be between 1 and 80 characters`);
  }
  return value;
}

export function normalizeOptionalExternalId(raw: string | undefined, label: string): string | undefined {
  const value = raw?.trim();
  if (!value) {
    return undefined;
  }
  return normalizeExternalId(value, label);
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseOptionalDate(raw: string | Date | undefined, label: string): Date | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidOrderError(`${label} must be a valid timestamp`);
  }
  return date;
}
