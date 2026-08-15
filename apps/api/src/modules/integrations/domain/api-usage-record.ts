import {
  PUBLIC_API_AUTH_KINDS,
  type PublicApiAuthKind,
} from '@ai-customer-support/contracts';
import { InvalidApiUsageError } from './errors.js';
import { createPublicApiUsageId, type PublicApiUsageId } from './ids.js';
import {
  MAX_USAGE_PATH_LENGTH,
  MAX_USAGE_USER_AGENT_LENGTH,
  normalizePublicApiRoute,
} from './api-version.js';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export type PublicApiUsageRecordSnapshot = {
  readonly id: PublicApiUsageId;
  readonly organizationId: string;
  readonly actorId?: string;
  readonly authKind: PublicApiAuthKind;
  readonly credentialId?: string;
  readonly method: string;
  readonly path: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
};

export class PublicApiUsageRecord {
  private constructor(
    readonly id: PublicApiUsageId,
    readonly organizationId: string,
    readonly actorId: string | undefined,
    readonly authKind: PublicApiAuthKind,
    readonly credentialId: string | undefined,
    readonly method: string,
    readonly path: string,
    readonly route: string,
    readonly statusCode: number,
    readonly durationMs: number,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
    readonly occurredAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly actorId?: string;
    readonly authKind: PublicApiAuthKind;
    readonly credentialId?: string;
    readonly method: string;
    readonly path: string;
    readonly statusCode: number;
    readonly durationMs: number;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
    readonly occurredAt: Date;
    readonly id?: PublicApiUsageId;
  }): PublicApiUsageRecord {
    const method = input.method.toUpperCase();
    if (!(HTTP_METHODS as readonly string[]).includes(method)) {
      throw new InvalidApiUsageError('Unsupported HTTP method');
    }
    if (!Number.isInteger(input.statusCode) || input.statusCode < 100 || input.statusCode > 599) {
      throw new InvalidApiUsageError('Invalid HTTP status code');
    }
    const path = input.path.split('?')[0]?.slice(0, MAX_USAGE_PATH_LENGTH) ?? '/';
    return new PublicApiUsageRecord(
      input.id ?? createPublicApiUsageId(),
      input.organizationId,
      input.actorId,
      input.authKind,
      input.credentialId,
      method,
      path,
      normalizePublicApiRoute(path),
      input.statusCode,
      Math.max(0, Math.round(input.durationMs)),
      input.ipAddress,
      input.userAgent?.slice(0, MAX_USAGE_USER_AGENT_LENGTH),
      input.requestId,
      input.occurredAt,
    );
  }

  static reconstitute(snapshot: PublicApiUsageRecordSnapshot): PublicApiUsageRecord {
    return new PublicApiUsageRecord(
      snapshot.id,
      snapshot.organizationId,
      snapshot.actorId,
      snapshot.authKind,
      snapshot.credentialId,
      snapshot.method,
      snapshot.path,
      snapshot.route,
      snapshot.statusCode,
      snapshot.durationMs,
      snapshot.ipAddress,
      snapshot.userAgent,
      snapshot.requestId,
      snapshot.occurredAt,
    );
  }

  toSnapshot(): PublicApiUsageRecordSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      actorId: this.actorId,
      authKind: this.authKind,
      credentialId: this.credentialId,
      method: this.method,
      path: this.path,
      route: this.route,
      statusCode: this.statusCode,
      durationMs: this.durationMs,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      requestId: this.requestId,
      occurredAt: this.occurredAt,
    };
  }
}

export function parsePublicApiAuthKind(value: string): PublicApiAuthKind {
  if (!(PUBLIC_API_AUTH_KINDS as readonly string[]).includes(value)) {
    throw new InvalidApiUsageError('Invalid public API auth kind');
  }
  return value as PublicApiAuthKind;
}
