import type { DomainEvent } from '@ai-customer-support/shared';
import type { ObservabilityIncidentSeverity, ObservabilityIncidentSource } from '@ai-customer-support/contracts';

export class ObservabilityIncidentOpenedEvent implements DomainEvent {
  readonly eventName = 'ObservabilityIncidentOpened';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly incidentId: string,
    readonly source: ObservabilityIncidentSource,
    readonly severity: ObservabilityIncidentSeverity,
    readonly tenantId?: string,
    readonly correlationId?: string,
  ) {}
}

export class ObservabilityIncidentAcknowledgedEvent implements DomainEvent {
  readonly eventName = 'ObservabilityIncidentAcknowledged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly incidentId: string,
    readonly tenantId?: string,
    readonly correlationId?: string,
  ) {}
}

export class ObservabilityIncidentResolvedEvent implements DomainEvent {
  readonly eventName = 'ObservabilityIncidentResolved';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly incidentId: string,
    readonly tenantId?: string,
    readonly correlationId?: string,
  ) {}
}
