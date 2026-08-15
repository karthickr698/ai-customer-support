import type { DomainEvent } from '@ai-customer-support/shared';

export class AutomationRuleCreatedEvent implements DomainEvent {
  readonly eventName = 'AutomationRuleCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AutomationRuleUpdatedEvent implements DomainEvent {
  readonly eventName = 'AutomationRuleUpdated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AutomationRuleDeletedEvent implements DomainEvent {
  readonly eventName = 'AutomationRuleDeleted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AutomationJobEnqueuedEvent implements DomainEvent {
  readonly eventName = 'AutomationJobEnqueued';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly jobId: string,
    readonly triggerKind: string,
    readonly correlationId?: string,
  ) {}
}

export class AutomationJobSucceededEvent implements DomainEvent {
  readonly eventName = 'AutomationJobSucceeded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly jobId: string,
    readonly attempt: number,
    readonly correlationId?: string,
  ) {}
}

export class AutomationJobFailedEvent implements DomainEvent {
  readonly eventName = 'AutomationJobFailed';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly jobId: string,
    readonly attempt: number,
    readonly terminal: boolean,
    readonly correlationId?: string,
  ) {}
}

export class AutomationActionExecutedEvent implements DomainEvent {
  readonly eventName = 'AutomationActionExecuted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ruleId: string,
    readonly jobId: string,
    readonly actionType: string,
    readonly data: Record<string, unknown>,
    readonly correlationId?: string,
  ) {}
}
