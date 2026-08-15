import {
  SECURITY_AUDIT_ACTIONS,
  SECURITY_AUDIT_OUTCOMES,
  SECURITY_ENCRYPTION_ALGORITHMS,
  SECURITY_SECRET_PURPOSES,
  type SecurityAuditAction,
  type SecurityAuditOutcome,
  type SecurityEncryptionAlgorithm,
  type SecuritySecretPurpose,
} from '@ai-customer-support/contracts';
import { InvalidSecurityError } from './errors.js';
import { SENSITIVE_METADATA_KEYS } from './security-controls.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_PATTERN = /^[0-9a-f:]+$/i;

export function parseSecretPurpose(value: string): SecuritySecretPurpose {
  if (!(SECURITY_SECRET_PURPOSES as readonly string[]).includes(value)) {
    throw new InvalidSecurityError(
      'Secret purpose must be api_credential, webhook, integration, encryption, or other',
    );
  }
  return value as SecuritySecretPurpose;
}

export function parseAuditOutcome(value: string): SecurityAuditOutcome {
  if (!(SECURITY_AUDIT_OUTCOMES as readonly string[]).includes(value)) {
    throw new InvalidSecurityError('Audit outcome must be success, denied, or failure');
  }
  return value as SecurityAuditOutcome;
}

export function parseAuditAction(value: string): SecurityAuditAction | string {
  const trimmed = normalizeText(value, 'Action', 1, 80);
  if ((SECURITY_AUDIT_ACTIONS as readonly string[]).includes(trimmed)) {
    return trimmed as SecurityAuditAction;
  }
  return trimmed;
}

export function parseEncryptionAlgorithm(value: string): SecurityEncryptionAlgorithm {
  if (!(SECURITY_ENCRYPTION_ALGORITHMS as readonly string[]).includes(value)) {
    throw new InvalidSecurityError('Encryption algorithm must be aes-256-gcm');
  }
  return value as SecurityEncryptionAlgorithm;
}

export function normalizeText(raw: string, label: string, min: number, max: number): string {
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    throw new InvalidSecurityError(`${label} must be between ${min} and ${max} characters`);
  }
  return value;
}

export function normalizeSecretName(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!SECRET_NAME_PATTERN.test(value)) {
    throw new InvalidSecurityError(
      'Secret name must start with a letter and contain only lowercase letters, numbers, and underscores (2-64 characters)',
    );
  }
  return value;
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new InvalidSecurityError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function requireBoundedInt(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidSecurityError(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function requirePlaintext(raw: string, maxBytes: number): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new InvalidSecurityError('plaintext is required');
  }
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes > maxBytes) {
    throw new InvalidSecurityError(`plaintext must be at most ${maxBytes} bytes`);
  }
  if (raw.includes('\0')) {
    throw new InvalidSecurityError('plaintext must not contain null bytes');
  }
  return raw;
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

export function ipv4ToInt(ip: string): number | null {
  const match = IPV4_PATTERN.exec(ip);
  if (!match) {
    return null;
  }
  let value = 0;
  for (let index = 1; index <= 4; index += 1) {
    const octet = Number(match[index]);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

export function expandIpv6(ip: string): bigint | null {
  const trimmed = ip.trim().toLowerCase();
  if (!IPV6_PATTERN.test(trimmed) || trimmed.includes(':::')) {
    return null;
  }
  const sides = trimmed.split('::');
  if (sides.length > 2) {
    return null;
  }
  const head = sides[0] ? sides[0].split(':').filter(Boolean) : [];
  const tail = sides[1] ? sides[1].split(':').filter(Boolean) : [];
  if (head.some((part) => part.length > 4) || tail.some((part) => part.length > 4)) {
    return null;
  }
  const missing = 8 - (head.length + tail.length);
  if (sides.length === 2 && missing < 0) {
    return null;
  }
  if (sides.length === 1 && head.length !== 8) {
    return null;
  }
  const parts = sides.length === 2 ? [...head, ...Array.from({ length: missing }, () => '0'), ...tail] : head;
  if (parts.length !== 8) {
    return null;
  }
  let value = 0n;
  for (const part of parts) {
    const n = Number.parseInt(part, 16);
    if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
      return null;
    }
    value = (value << 16n) + BigInt(n);
  }
  return value;
}

export function normalizeCidr(raw: string): string {
  const value = raw.trim();
  if (value.includes('/')) {
    const [address, prefixRaw] = value.split('/');
    const prefix = Number(prefixRaw);
    if (!address || !Number.isInteger(prefix)) {
      throw new InvalidSecurityError('CIDR must be an IPv4 or IPv6 network with a prefix length');
    }
    if (ipv4ToInt(address) !== null) {
      if (prefix < 8 || prefix > 32) {
        throw new InvalidSecurityError('IPv4 allowlist prefixes must be between /8 and /32');
      }
      return `${address}/${prefix}`;
    }
    if (expandIpv6(address) !== null) {
      if (prefix < 32 || prefix > 128) {
        throw new InvalidSecurityError('IPv6 allowlist prefixes must be between /32 and /128');
      }
      return `${address.toLowerCase()}/${prefix}`;
    }
    throw new InvalidSecurityError('CIDR address must be a valid IPv4 or IPv6 address');
  }
  if (ipv4ToInt(value) !== null) {
    return `${value}/32`;
  }
  if (expandIpv6(value) !== null) {
    return `${value.toLowerCase()}/128`;
  }
  throw new InvalidSecurityError('Allowlist entry must be an IPv4 or IPv6 address or CIDR');
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split('/');
  const prefix = Number(prefixRaw);
  if (!network || !Number.isInteger(prefix)) {
    return false;
  }
  const ipv4 = ipv4ToInt(ip);
  const networkV4 = ipv4ToInt(network);
  if (ipv4 !== null && networkV4 !== null) {
    if (prefix === 32) {
      return ipv4 === networkV4;
    }
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipv4 & mask) === (networkV4 & mask);
  }
  const ipv6 = expandIpv6(ip);
  const networkV6 = expandIpv6(network);
  if (ipv6 !== null && networkV6 !== null) {
    const shift = BigInt(128 - prefix);
    const mask = prefix === 0 ? 0n : (~0n << shift) & ((1n << 128n) - 1n);
    return (ipv6 & mask) === (networkV6 & mask);
  }
  return false;
}

export function ipAllowed(ip: string, cidrs: readonly string[]): boolean {
  const candidate = ip.trim();
  if (!candidate) {
    return false;
  }
  return cidrs.some((cidr) => ipMatchesCidr(candidate, cidr));
}
