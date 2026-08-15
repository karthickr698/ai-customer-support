import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_OUTCOMES,
  PLATFORM_ROLES,
  type PlatformAuditAction,
  type PlatformAuditOutcome,
  type PlatformRole,
} from '@ai-customer-support/contracts';
import { InvalidPlatformError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FLAG_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export const SENSITIVE_METADATA_KEYS = [
  'plaintext',
  'password',
  'secret',
  'token',
  'authorization',
  'apiKey',
  'api_key',
] as const;

export function parsePlatformRole(value: string): PlatformRole {
  if (!(PLATFORM_ROLES as readonly string[]).includes(value)) {
    throw new InvalidPlatformError('Role must be owner, admin, operator, or auditor');
  }
  return value as PlatformRole;
}

export function parseAuditOutcome(value: string): PlatformAuditOutcome {
  if (!(PLATFORM_AUDIT_OUTCOMES as readonly string[]).includes(value)) {
    throw new InvalidPlatformError('Audit outcome must be success, denied, or failure');
  }
  return value as PlatformAuditOutcome;
}

export function parseAuditAction(value: string): PlatformAuditAction | string {
  const trimmed = normalizeText(value, 'Action', 1, 80);
  if ((PLATFORM_AUDIT_ACTIONS as readonly string[]).includes(trimmed)) {
    return trimmed as PlatformAuditAction;
  }
  return trimmed;
}

export function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidPlatformError(`${label} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function normalizeFlagKey(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!FLAG_KEY_PATTERN.test(value)) {
    throw new InvalidPlatformError(
      'Flag key must start with a letter and contain only lowercase letters, numbers, and underscores (2-64 characters)',
    );
  }
  return value;
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new InvalidPlatformError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function redactMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowered = key.toLowerCase();
    const sensitive = SENSITIVE_METADATA_KEYS.some((name) => lowered.includes(name.toLowerCase()));
    redacted[key] = sensitive ? '[redacted]' : value;
  }
  return redacted;
}
