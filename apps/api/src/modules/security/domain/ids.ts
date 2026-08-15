export type SecurityIpAllowlistEntryId = string & { readonly __brand: 'SecurityIpAllowlistEntryId' };
export type SecuritySecretId = string & { readonly __brand: 'SecuritySecretId' };
export type SecurityAuditEventId = string & { readonly __brand: 'SecurityAuditEventId' };

export function createSecurityIpAllowlistEntryId(
  id: string = crypto.randomUUID(),
): SecurityIpAllowlistEntryId {
  return id as SecurityIpAllowlistEntryId;
}

export function createSecuritySecretId(id: string = crypto.randomUUID()): SecuritySecretId {
  return id as SecuritySecretId;
}

export function createSecurityAuditEventId(id: string = crypto.randomUUID()): SecurityAuditEventId {
  return id as SecurityAuditEventId;
}
