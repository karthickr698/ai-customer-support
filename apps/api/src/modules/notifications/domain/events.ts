import type { DomainEvent } from '@ai-customer-support/shared';

export class NotificationTemplateCreatedEvent implements DomainEvent {
  readonly eventName = 'NotificationTemplateCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly templateId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class NotificationTemplateUpdatedEvent implements DomainEvent {
  readonly eventName = 'NotificationTemplateUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly templateId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class NotificationTemplateDeletedEvent implements DomainEvent {
  readonly eventName = 'NotificationTemplateDeleted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly templateId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class NotificationRequestedEvent implements DomainEvent {
  readonly eventName = 'NotificationRequested';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly deliveryId: string,
    readonly channel: string,
    readonly eventType: string,
    readonly correlationId?: string,
  ) {}
}

export class NotificationDeliveredEvent implements DomainEvent {
  readonly eventName = 'NotificationDelivered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly deliveryId: string,
    readonly channel: string,
    readonly attempt: number,
    readonly provider: string,
    readonly correlationId?: string,
  ) {}
}

export class NotificationFailedEvent implements DomainEvent {
  readonly eventName = 'NotificationFailed';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly deliveryId: string,
    readonly channel: string,
    readonly attempt: number,
    readonly terminal: boolean,
    readonly correlationId?: string,
  ) {}
}

export class NotificationSkippedEvent implements DomainEvent {
  readonly eventName = 'NotificationSkipped';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly deliveryId: string,
    readonly reason: string,
    readonly correlationId?: string,
  ) {}
}
