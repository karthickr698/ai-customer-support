import { InsufficientSecurityPermissionError, InvalidSecurityError } from './errors.js';
import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  DEFAULT_MAX_REQUEST_BYTES,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS,
  MAX_AUDIT_RETENTION_DAYS,
  MAX_REQUEST_BYTES,
  MAX_RATE_LIMIT_PER_MINUTE,
  MAX_SESSION_IDLE_TIMEOUT_SECONDS,
  MIN_AUDIT_RETENTION_DAYS,
  MIN_MAX_REQUEST_BYTES,
  MIN_RATE_LIMIT_PER_MINUTE,
  MIN_SESSION_IDLE_TIMEOUT_SECONDS,
} from './security-controls.js';
import { requireBoundedInt } from './values.js';

export type SecurityPolicySnapshot = {
  readonly organizationId: string;
  readonly ipAllowlistEnabled: boolean;
  readonly mfaRequired: boolean;
  readonly sessionIdleTimeoutSeconds: number;
  readonly maxRequestBytes: number;
  readonly rateLimitPerMinute: number;
  readonly auditRetentionDays: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class SecurityPolicy {
  private constructor(
    readonly organizationId: string,
    private ipAllowlistEnabledValue: boolean,
    private mfaRequiredValue: boolean,
    private sessionIdleTimeoutSecondsValue: number,
    private maxRequestBytesValue: number,
    private rateLimitPerMinuteValue: number,
    private auditRetentionDaysValue: number,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static defaults(organizationId: string, now: Date): SecurityPolicy {
    if (!organizationId.trim()) {
      throw new InvalidSecurityError('Organization is required');
    }
    return new SecurityPolicy(
      organizationId,
      false,
      false,
      DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS,
      DEFAULT_MAX_REQUEST_BYTES,
      DEFAULT_RATE_LIMIT_PER_MINUTE,
      DEFAULT_AUDIT_RETENTION_DAYS,
      now,
      now,
    );
  }

  static reconstitute(snapshot: SecurityPolicySnapshot): SecurityPolicy {
    return new SecurityPolicy(
      snapshot.organizationId,
      snapshot.ipAllowlistEnabled,
      snapshot.mfaRequired,
      snapshot.sessionIdleTimeoutSeconds,
      snapshot.maxRequestBytes,
      snapshot.rateLimitPerMinute,
      snapshot.auditRetentionDays,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get ipAllowlistEnabled(): boolean {
    return this.ipAllowlistEnabledValue;
  }

  get mfaRequired(): boolean {
    return this.mfaRequiredValue;
  }

  get sessionIdleTimeoutSeconds(): number {
    return this.sessionIdleTimeoutSecondsValue;
  }

  get maxRequestBytes(): number {
    return this.maxRequestBytesValue;
  }

  get rateLimitPerMinute(): number {
    return this.rateLimitPerMinuteValue;
  }

  get auditRetentionDays(): number {
    return this.auditRetentionDaysValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  update(
    patch: {
      readonly ipAllowlistEnabled?: boolean;
      readonly mfaRequired?: boolean;
      readonly sessionIdleTimeoutSeconds?: number;
      readonly maxRequestBytes?: number;
      readonly rateLimitPerMinute?: number;
      readonly auditRetentionDays?: number;
    },
    now: Date,
  ): void {
    if (patch.ipAllowlistEnabled !== undefined) {
      this.ipAllowlistEnabledValue = patch.ipAllowlistEnabled;
    }
    if (patch.mfaRequired !== undefined) {
      this.mfaRequiredValue = patch.mfaRequired;
    }
    if (patch.sessionIdleTimeoutSeconds !== undefined) {
      this.sessionIdleTimeoutSecondsValue = requireBoundedInt(
        patch.sessionIdleTimeoutSeconds,
        'sessionIdleTimeoutSeconds',
        MIN_SESSION_IDLE_TIMEOUT_SECONDS,
        MAX_SESSION_IDLE_TIMEOUT_SECONDS,
      );
    }
    if (patch.maxRequestBytes !== undefined) {
      this.maxRequestBytesValue = requireBoundedInt(
        patch.maxRequestBytes,
        'maxRequestBytes',
        MIN_MAX_REQUEST_BYTES,
        MAX_REQUEST_BYTES,
      );
    }
    if (patch.rateLimitPerMinute !== undefined) {
      this.rateLimitPerMinuteValue = requireBoundedInt(
        patch.rateLimitPerMinute,
        'rateLimitPerMinute',
        MIN_RATE_LIMIT_PER_MINUTE,
        MAX_RATE_LIMIT_PER_MINUTE,
      );
    }
    if (patch.auditRetentionDays !== undefined) {
      this.auditRetentionDaysValue = requireBoundedInt(
        patch.auditRetentionDays,
        'auditRetentionDays',
        MIN_AUDIT_RETENTION_DAYS,
        MAX_AUDIT_RETENTION_DAYS,
      );
    }
    this.updatedAtValue = now;
  }

  toSnapshot(): SecurityPolicySnapshot {
    return {
      organizationId: this.organizationId,
      ipAllowlistEnabled: this.ipAllowlistEnabledValue,
      mfaRequired: this.mfaRequiredValue,
      sessionIdleTimeoutSeconds: this.sessionIdleTimeoutSecondsValue,
      maxRequestBytes: this.maxRequestBytesValue,
      rateLimitPerMinute: this.rateLimitPerMinuteValue,
      auditRetentionDays: this.auditRetentionDaysValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }

  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientSecurityPermissionError(permission);
    }
  }
}
