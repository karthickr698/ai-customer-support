import type { DomainEvent } from '@ai-customer-support/shared';

export class UserRegisteredEvent implements DomainEvent {
  readonly eventName = 'UserRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly email: string,
    readonly correlationId?: string,
  ) {}
}

export class UserLoggedInEvent implements DomainEvent {
  readonly eventName = 'UserLoggedIn';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly method: 'password' | 'google',
    readonly correlationId?: string,
  ) {}
}

export class UserLoggedOutEvent implements DomainEvent {
  readonly eventName = 'UserLoggedOut';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class EmailVerifiedEvent implements DomainEvent {
  readonly eventName = 'EmailVerified';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class PasswordResetRequestedEvent implements DomainEvent {
  readonly eventName = 'PasswordResetRequested';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class PasswordResetCompletedEvent implements DomainEvent {
  readonly eventName = 'PasswordResetCompleted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}

export class GoogleAccountLinkedEvent implements DomainEvent {
  readonly eventName = 'GoogleAccountLinked';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly userId: string,
    readonly correlationId?: string,
  ) {}
}
