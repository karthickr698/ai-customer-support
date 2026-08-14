import type { DomainEvent } from '@ai-customer-support/shared';

export class OrganizationCreatedEvent implements DomainEvent {
  readonly eventName = 'OrganizationCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly ownerUserId: string,
    readonly correlationId?: string,
  ) {}
}

export class OrganizationUpdatedEvent implements DomainEvent {
  readonly eventName = 'OrganizationUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly correlationId?: string,
  ) {}
}

export class MemberInvitedEvent implements DomainEvent {
  readonly eventName = 'MemberInvited';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly invitationId: string,
    readonly email: string,
    readonly role: string,
    readonly correlationId?: string,
  ) {}
}

export class InvitationAcceptedEvent implements DomainEvent {
  readonly eventName = 'InvitationAccepted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly invitationId: string,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class InvitationRevokedEvent implements DomainEvent {
  readonly eventName = 'InvitationRevoked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly invitationId: string,
    readonly correlationId?: string,
  ) {}
}

export class MemberRoleChangedEvent implements DomainEvent {
  readonly eventName = 'MemberRoleChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly membershipId: string,
    readonly userId: string,
    readonly role: string,
    readonly correlationId?: string,
  ) {}
}

export class MemberRemovedEvent implements DomainEvent {
  readonly eventName = 'MemberRemoved';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly membershipId: string,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class MemberLeftEvent implements DomainEvent {
  readonly eventName = 'MemberLeft';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly organizationId: string,
    readonly membershipId: string,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}
