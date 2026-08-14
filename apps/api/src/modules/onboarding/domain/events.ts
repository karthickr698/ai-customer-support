import type { DomainEvent } from '@ai-customer-support/shared';

export class BusinessProfileGeneratedEvent implements DomainEvent {
  readonly eventName = 'BusinessProfileGenerated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class SupportTonesGeneratedEvent implements DomainEvent {
  readonly eventName = 'SupportTonesGenerated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly selectedToneId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AgentSettingsGeneratedEvent implements DomainEvent {
  readonly eventName = 'AgentSettingsGenerated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class OnboardingCompletedEvent implements DomainEvent {
  readonly eventName = 'OnboardingCompleted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}
