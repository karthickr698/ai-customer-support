import type { DomainEvent } from '@ai-customer-support/shared';

export class TicketCreatedEvent implements DomainEvent {
  readonly eventName = 'TicketCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly actorId: string,
    readonly conversationId: string | undefined,
    readonly source: string,
    readonly correlationId?: string,
  ) {}
}

export class TicketStatusChangedEvent implements DomainEvent {
  readonly eventName = 'TicketStatusChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly fromStatus: string,
    readonly toStatus: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class TicketAssignedEvent implements DomainEvent {
  readonly eventName = 'TicketAssigned';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly assignedAgentId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class TicketUnassignedEvent implements DomainEvent {
  readonly eventName = 'TicketUnassigned';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class TicketEscalatedEvent implements DomainEvent {
  readonly eventName = 'TicketEscalated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly actorId: string,
    readonly reason: string | undefined,
    readonly correlationId?: string,
  ) {}
}

export class TicketNoteAddedEvent implements DomainEvent {
  readonly eventName = 'TicketNoteAdded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly noteId: string,
    readonly authorId: string,
    readonly correlationId?: string,
  ) {}
}

export class TicketAttachmentUploadedEvent implements DomainEvent {
  readonly eventName = 'TicketAttachmentUploaded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly attachmentId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class TicketSlaBreachedEvent implements DomainEvent {
  readonly eventName = 'TicketSlaBreached';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly ticketId: string,
    readonly breachKind: string,
    readonly correlationId?: string,
  ) {}
}
