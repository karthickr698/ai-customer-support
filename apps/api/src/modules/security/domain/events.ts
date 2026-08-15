import type { DomainEvent } from '@ai-customer-support/shared';

export class SecurityPolicyUpdatedEvent implements DomainEvent {
  readonly eventName = 'SecurityPolicyUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly correlationId?: string,
  ) {}
}

export class SecuritySecretCreatedEvent implements DomainEvent {
  readonly eventName = 'SecuritySecretCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly secretId: string,
    readonly name: string,
    readonly purpose: string,
    readonly correlationId?: string,
  ) {}
}

export class SecuritySecretRotatedEvent implements DomainEvent {
  readonly eventName = 'SecuritySecretRotated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly secretId: string,
    readonly name: string,
    readonly correlationId?: string,
  ) {}
}

export class SecuritySecretRevokedEvent implements DomainEvent {
  readonly eventName = 'SecuritySecretRevoked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly secretId: string,
    readonly name: string,
    readonly correlationId?: string,
  ) {}
}

export class SecurityIpAllowlistChangedEvent implements DomainEvent {
  readonly eventName = 'SecurityIpAllowlistChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly action: 'added' | 'removed',
    readonly cidr: string,
    readonly correlationId?: string,
  ) {}
}
