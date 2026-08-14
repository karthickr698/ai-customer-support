import type { DomainEvent } from '@ai-customer-support/shared';

export class WidgetConfigurationUpdatedEvent implements DomainEvent {
  readonly eventName = 'WidgetConfigurationUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly widgetConfigurationId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class WidgetSessionCreatedEvent implements DomainEvent {
  readonly eventName = 'WidgetSessionCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly sessionId: string,
    readonly kind: string,
    readonly correlationId?: string,
  ) {}
}

export class WidgetSessionIdentifiedEvent implements DomainEvent {
  readonly eventName = 'WidgetSessionIdentified';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly sessionId: string,
    readonly correlationId?: string,
  ) {}
}
