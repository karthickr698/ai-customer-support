import type { DomainEvent } from '@ai-customer-support/shared';

export class CustomerRegisteredEvent implements DomainEvent {
  readonly eventName = 'CustomerRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly customerId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class ProductRegisteredEvent implements DomainEvent {
  readonly eventName = 'ProductRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly productId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class OrderRegisteredEvent implements DomainEvent {
  readonly eventName = 'OrderRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly orderId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class ShipmentRegisteredEvent implements DomainEvent {
  readonly eventName = 'ShipmentRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly shipmentId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class ReturnRegisteredEvent implements DomainEvent {
  readonly eventName = 'ReturnRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly returnId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}
