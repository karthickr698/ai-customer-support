import type { DomainEvent } from '@ai-customer-support/shared';

export class AgentPresenceChangedEvent implements DomainEvent {
  readonly eventName = 'AgentPresenceChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly agentId: string,
    readonly status: string,
    readonly connectionCount: number,
    readonly correlationId?: string,
  ) {}
}
