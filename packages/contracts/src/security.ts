/**
 * Cross-runtime DTOs for tenant security controls: encryption, secret isolation,
 * rate limits, IP allowlists, audit logs, and policy.
 */

export const SECURITY_SECRET_PURPOSES = [
  'api_credential',
  'webhook',
  'integration',
  'encryption',
  'other',
] as const;
export type SecuritySecretPurpose = (typeof SECURITY_SECRET_PURPOSES)[number];

export const SECURITY_AUDIT_OUTCOMES = ['success', 'denied', 'failure'] as const;
export type SecurityAuditOutcome = (typeof SECURITY_AUDIT_OUTCOMES)[number];

export const SECURITY_AUDIT_ACTIONS = [
  'security.policy.updated',
  'security.secret.created',
  'security.secret.revealed',
  'security.secret.rotated',
  'security.secret.revoked',
  'security.ip_allowlist.added',
  'security.ip_allowlist.removed',
  'security.encrypt.performed',
  'security.decrypt.performed',
  'security.authorization.denied',
] as const;
export type SecurityAuditAction = (typeof SECURITY_AUDIT_ACTIONS)[number];

export const SECURITY_ENCRYPTION_ALGORITHMS = ['aes-256-gcm'] as const;
export type SecurityEncryptionAlgorithm = (typeof SECURITY_ENCRYPTION_ALGORITHMS)[number];

export type SecurityPolicyDto = {
  readonly organizationId: string;
  readonly ipAllowlistEnabled: boolean;
  readonly mfaRequired: boolean;
  readonly sessionIdleTimeoutSeconds: number;
  readonly maxRequestBytes: number;
  readonly rateLimitPerMinute: number;
  readonly auditRetentionDays: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SecurityPolicyResponse = {
  readonly policy: SecurityPolicyDto;
};

export type UpdateSecurityPolicyRequest = {
  readonly ipAllowlistEnabled?: boolean;
  readonly mfaRequired?: boolean;
  readonly sessionIdleTimeoutSeconds?: number;
  readonly maxRequestBytes?: number;
  readonly rateLimitPerMinute?: number;
  readonly auditRetentionDays?: number;
};

export type SecurityIpAllowlistEntryDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly cidr: string;
  readonly label: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
};

export type SecurityIpAllowlistResponse = {
  readonly items: readonly SecurityIpAllowlistEntryDto[];
  readonly enabled: boolean;
};

export type AddSecurityIpAllowlistEntryRequest = {
  readonly cidr: string;
  readonly label?: string;
};

export type SecurityIpAllowlistEntryResponse = {
  readonly entry: SecurityIpAllowlistEntryDto;
};

export type SecuritySecretDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly purpose: SecuritySecretPurpose;
  readonly keyVersion: number;
  readonly lastAccessedAt: string | null;
  readonly rotatedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SecuritySecretListResponse = {
  readonly items: readonly SecuritySecretDto[];
};

export type SecuritySecretResponse = {
  readonly secret: SecuritySecretDto;
};

export type CreateSecuritySecretRequest = {
  readonly name: string;
  readonly purpose: SecuritySecretPurpose;
  readonly plaintext: string;
};

export type RotateSecuritySecretRequest = {
  readonly plaintext: string;
};

export type RevealedSecuritySecretDto = SecuritySecretDto & {
  readonly plaintext: string;
};

export type RevealSecuritySecretResponse = {
  readonly secret: RevealedSecuritySecretDto;
};

export type SecurityEncryptionEnvelopeDto = {
  readonly algorithm: SecurityEncryptionAlgorithm;
  readonly keyVersion: number;
  readonly ciphertext: string;
  readonly nonce: string;
};

export type EncryptPayloadRequest = {
  readonly plaintext: string;
};

export type EncryptPayloadResponse = {
  readonly envelope: SecurityEncryptionEnvelopeDto;
};

export type DecryptPayloadRequest = {
  readonly algorithm?: SecurityEncryptionAlgorithm;
  readonly keyVersion: number;
  readonly ciphertext: string;
  readonly nonce: string;
};

export type DecryptPayloadResponse = {
  readonly plaintext: string;
};

export type SecurityAuditEventDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly outcome: SecurityAuditOutcome;
  readonly metadata: Record<string, unknown> | null;
  readonly ipAddress: string | null;
  readonly occurredAt: string;
};

export type SecurityAuditLogListResponse = {
  readonly items: readonly SecurityAuditEventDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type SecurityRateLimitWindowDto = {
  readonly key: string;
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
  readonly windowSeconds: number;
  readonly resetAt: string | null;
};

export type SecurityRateLimitsResponse = {
  readonly ip: SecurityRateLimitWindowDto;
  readonly tenant: SecurityRateLimitWindowDto;
};
