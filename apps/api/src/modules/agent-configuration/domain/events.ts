import type { DomainEvent } from '@ai-customer-support/shared';

export class AiAgentConfigurationUpdatedEvent implements DomainEvent {
  readonly eventName = 'AiAgentConfigurationUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly configurationId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}
