export type PlatformOperatorId = string & { readonly __brand: 'PlatformOperatorId' };
export type FeatureFlagId = string & { readonly __brand: 'FeatureFlagId' };
export type FeatureFlagOverrideId = string & { readonly __brand: 'FeatureFlagOverrideId' };
export type OperationalAuditEventId = string & { readonly __brand: 'OperationalAuditEventId' };

export function createPlatformOperatorId(id: string = crypto.randomUUID()): PlatformOperatorId {
  return id as PlatformOperatorId;
}

export function createFeatureFlagId(id: string = crypto.randomUUID()): FeatureFlagId {
  return id as FeatureFlagId;
}

export function createFeatureFlagOverrideId(id: string = crypto.randomUUID()): FeatureFlagOverrideId {
  return id as FeatureFlagOverrideId;
}

export function createOperationalAuditEventId(id: string = crypto.randomUUID()): OperationalAuditEventId {
  return id as OperationalAuditEventId;
}
