import type { IntegrationCredentialKind, ToolName } from '@ai-customer-support/contracts';
import { INTEGRATION_CREDENTIAL_KINDS, TOOL_NAMES } from '@ai-customer-support/contracts';
import { InvalidIntegrationCredentialError } from './errors.js';
import { createIntegrationCredentialId, type IntegrationCredentialId } from './ids.js';
import { assertSafeHttpsUrl } from './outbound-url.js';
import { parseToolName } from './tool-catalog.js';

const MAX_NAME = 120;
const MAX_SECRET = 8_000;
const MAX_HEADER = 80;

export type EncryptedSecret = {
  readonly ciphertext: string;
  readonly nonce: string;
};

export type IntegrationCredentialSnapshot = {
  readonly id: IntegrationCredentialId;
  readonly organizationId: string;
  readonly toolName: ToolName;
  readonly provider?: string;
  readonly name: string;
  readonly kind: IntegrationCredentialKind;
  readonly headerName: string;
  readonly baseUrl: string;
  readonly secret: EncryptedSecret;
  readonly secretLastFour: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revokedAt?: Date;
};

export class IntegrationCredential {
  private constructor(
    readonly id: IntegrationCredentialId,
    readonly organizationId: string,
    readonly toolName: ToolName,
    readonly provider: string | undefined,
    readonly name: string,
    readonly kind: IntegrationCredentialKind,
    readonly headerName: string,
    readonly baseUrl: string,
    readonly secret: EncryptedSecret,
    readonly secretLastFour: string,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly revokedAt: Date | undefined,
  ) {}

  get isActive(): boolean {
    return this.revokedAt === undefined;
  }

  static create(input: {
    readonly organizationId: string;
    readonly toolName: string;
    readonly name: string;
    readonly kind: string;
    readonly secret: EncryptedSecret;
    readonly plaintextSecret: string;
    readonly baseUrl: string;
    readonly headerName?: string;
    readonly provider?: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: IntegrationCredentialId;
  }): IntegrationCredential {
    const toolName = parseToolName(input.toolName);
    return new IntegrationCredential(
      input.id ?? createIntegrationCredentialId(),
      input.organizationId,
      toolName,
      normalizeProvider(input.provider),
      normalizeName(input.name),
      parseKind(input.kind),
      normalizeHeaderName(input.headerName),
      assertSafeHttpsUrl(input.baseUrl, 'Base URL'),
      input.secret,
      lastFour(input.plaintextSecret),
      input.createdByUserId,
      input.now,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: IntegrationCredentialSnapshot): IntegrationCredential {
    return new IntegrationCredential(
      snapshot.id,
      snapshot.organizationId,
      snapshot.toolName,
      snapshot.provider,
      snapshot.name,
      snapshot.kind,
      snapshot.headerName,
      snapshot.baseUrl,
      snapshot.secret,
      snapshot.secretLastFour,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.revokedAt,
    );
  }

  replaceSecret(input: {
    readonly secret: EncryptedSecret;
    readonly plaintextSecret: string;
    readonly name?: string;
    readonly kind?: string;
    readonly baseUrl?: string;
    readonly headerName?: string;
    readonly provider?: string;
    readonly now: Date;
  }): IntegrationCredential {
    if (!this.isActive) {
      throw new InvalidIntegrationCredentialError('This credential has been revoked');
    }
    return new IntegrationCredential(
      this.id,
      this.organizationId,
      this.toolName,
      input.provider !== undefined ? normalizeProvider(input.provider) : this.provider,
      input.name !== undefined ? normalizeName(input.name) : this.name,
      input.kind !== undefined ? parseKind(input.kind) : this.kind,
      input.headerName !== undefined ? normalizeHeaderName(input.headerName) : this.headerName,
      input.baseUrl !== undefined ? assertSafeHttpsUrl(input.baseUrl, 'Base URL') : this.baseUrl,
      input.secret,
      lastFour(input.plaintextSecret),
      this.createdByUserId,
      this.createdAt,
      input.now,
      undefined,
    );
  }

  revoke(now: Date): IntegrationCredential {
    if (!this.isActive) {
      return this;
    }
    return new IntegrationCredential(
      this.id,
      this.organizationId,
      this.toolName,
      this.provider,
      this.name,
      this.kind,
      this.headerName,
      this.baseUrl,
      this.secret,
      this.secretLastFour,
      this.createdByUserId,
      this.createdAt,
      now,
      now,
    );
  }

  authorizationHeader(plaintextSecret: string): { name: string; value: string } {
    if (this.kind === 'bearer') {
      return { name: this.headerName, value: `Bearer ${plaintextSecret}` };
    }
    return { name: this.headerName, value: plaintextSecret };
  }

  toSnapshot(): IntegrationCredentialSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      toolName: this.toolName,
      provider: this.provider,
      name: this.name,
      kind: this.kind,
      headerName: this.headerName,
      baseUrl: this.baseUrl,
      secret: this.secret,
      secretLastFour: this.secretLastFour,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      revokedAt: this.revokedAt,
    };
  }
}

export function assertSecret(raw: string): string {
  const secret = raw.trim();
  if (secret.length < 8 || secret.length > MAX_SECRET) {
    throw new InvalidIntegrationCredentialError('Secret must be between 8 and 8000 characters');
  }
  return secret;
}

function parseKind(value: string): IntegrationCredentialKind {
  if (!(INTEGRATION_CREDENTIAL_KINDS as readonly string[]).includes(value)) {
    throw new InvalidIntegrationCredentialError('Credential kind must be api_key or bearer');
  }
  return value as IntegrationCredentialKind;
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw new InvalidIntegrationCredentialError(`Name must be between 1 and ${MAX_NAME} characters`);
  }
  return name;
}

function normalizeHeaderName(raw: string | undefined): string {
  const name = (raw ?? 'Authorization').trim();
  if (name.length < 1 || name.length > MAX_HEADER) {
    throw new InvalidIntegrationCredentialError('Header name is invalid');
  }
  if (!/^[A-Za-z0-9-]+$/.test(name)) {
    throw new InvalidIntegrationCredentialError('Header name is invalid');
  }
  return name;
}

function normalizeProvider(raw: string | undefined): string | undefined {
  const provider = raw?.trim().toLowerCase();
  return provider ? provider.slice(0, 40) : undefined;
}

function lastFour(secret: string): string {
  const trimmed = secret.trim();
  return trimmed.slice(-4);
}

export function isToolNameValue(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}
