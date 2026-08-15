import type {
  BillingCheckoutStatus,
  BillingInvoiceLineKind,
  BillingInvoiceStatus,
  BillingInterval,
  BillingProviderName,
  BillingSubscriptionStatus,
  BillingUsageMetric,
} from '@ai-customer-support/contracts';
import {
  BILLING_CHECKOUT_STATUSES,
  BILLING_INVOICE_LINE_KINDS,
  BILLING_INVOICE_STATUSES,
  BILLING_INTERVALS,
  BILLING_PROVIDERS,
  BILLING_SUBSCRIPTION_STATUSES,
  BILLING_USAGE_METRICS,
} from '@ai-customer-support/contracts';
import { InvalidBillingError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export function parseInterval(value: string): BillingInterval {
  if (!(BILLING_INTERVALS as readonly string[]).includes(value)) {
    throw new InvalidBillingError('Billing interval must be month or year');
  }
  return value as BillingInterval;
}

export function parseSubscriptionStatus(value: string): BillingSubscriptionStatus {
  if (!(BILLING_SUBSCRIPTION_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidBillingError('Subscription status is invalid');
  }
  return value as BillingSubscriptionStatus;
}

export function parseUsageMetric(value: string): BillingUsageMetric {
  if (!(BILLING_USAGE_METRICS as readonly string[]).includes(value)) {
    throw new InvalidBillingError(
      'Metric must be conversations, ai_replies, seats, knowledge_documents, tickets, or messages',
    );
  }
  return value as BillingUsageMetric;
}

export function parseInvoiceStatus(value: string): BillingInvoiceStatus {
  if (!(BILLING_INVOICE_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidBillingError('Invoice status is invalid');
  }
  return value as BillingInvoiceStatus;
}

export function parseInvoiceLineKind(value: string): BillingInvoiceLineKind {
  if (!(BILLING_INVOICE_LINE_KINDS as readonly string[]).includes(value)) {
    throw new InvalidBillingError('Invoice line kind is invalid');
  }
  return value as BillingInvoiceLineKind;
}

export function parseProviderName(value: string): BillingProviderName {
  if (!(BILLING_PROVIDERS as readonly string[]).includes(value)) {
    throw new InvalidBillingError('Billing provider must be console or stripe');
  }
  return value as BillingProviderName;
}

export function parseCheckoutStatus(value: string): BillingCheckoutStatus {
  if (!(BILLING_CHECKOUT_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidBillingError('Checkout status is invalid');
  }
  return value as BillingCheckoutStatus;
}

export function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidBillingError(`${label} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function normalizeSlug(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!SLUG_PATTERN.test(value) || value.length > 80) {
    throw new InvalidBillingError(
      'Slug must be lowercase letters, numbers, and hyphens, at most 80 characters',
    );
  }
  return value;
}

export function normalizeCurrency(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(value)) {
    throw new InvalidBillingError('Currency must be a 3-letter ISO code');
  }
  return value;
}

export function normalizeUrl(raw: string, label: string, allowLocalHttp: boolean): string {
  const value = raw.trim();
  if (!URL_PATTERN.test(value) || value.length > 2_000) {
    throw new InvalidBillingError(`${label} must be an http(s) URL`);
  }
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && !(allowLocalHttp && parsed.protocol === 'http:')) {
    throw new InvalidBillingError(`${label} must use HTTPS`);
  }
  return value;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new InvalidBillingError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function requirePositiveInt(value: number, label: string, max = 1_000_000_000): number {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new InvalidBillingError(`${label} must be an integer between 0 and ${max}`);
  }
  return value;
}

export function requireQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
    throw new InvalidBillingError('quantity must be an integer between 1 and 1000000');
  }
  return value;
}

export function addUtcInterval(start: Date, interval: BillingInterval): Date {
  const next = new Date(start.getTime());
  if (interval === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    return next;
  }
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function invoiceNumber(periodStart: Date, invoiceId: string): string {
  const year = periodStart.getUTCFullYear();
  const month = String(periodStart.getUTCMonth() + 1).padStart(2, '0');
  const suffix = invoiceId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INV-${year}${month}-${suffix}`;
}
