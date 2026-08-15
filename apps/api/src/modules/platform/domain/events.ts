import type { DomainEvent } from '@ai-customer-support/shared';
import type { PlatformRole } from '@ai-customer-support/contracts';

export class PlatformOperatorGrantedEvent implements DomainEvent {
  readonly eventName = 'PlatformOperatorGranted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly role: PlatformRole,
    readonly correlationId?: string,
  ) {}
}

export class PlatformOperatorRoleChangedEvent implements DomainEvent {
  readonly eventName = 'PlatformOperatorRoleChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly role: PlatformRole,
    readonly correlationId?: string,
  ) {}
}

export class PlatformOperatorRevokedEvent implements DomainEvent {
  readonly eventName = 'PlatformOperatorRevoked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class PlatformTenantStatusChangedEvent implements DomainEvent {
  readonly eventName = 'PlatformTenantStatusChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly status: 'active' | 'disabled',
    readonly correlationId?: string,
  ) {}
}

export class FeatureFlagChangedEvent implements DomainEvent {
  readonly eventName = 'FeatureFlagChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly flagKey: string,
    readonly action: 'created' | 'updated' | 'deleted' | 'override_set' | 'override_removed',
    readonly tenantId?: string,
    readonly correlationId?: string,
  ) {}
}
