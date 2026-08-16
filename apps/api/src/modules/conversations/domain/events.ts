import type { DomainEvent } from '@ai-customer-support/shared';

export class ConversationCreatedEvent implements DomainEvent {
  readonly eventName = 'ConversationCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly createdByUserId: string,
    readonly correlationId?: string,
  ) {}
}

export class MessageReceivedEvent implements DomainEvent {
  readonly eventName = 'MessageReceived';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly messageId: string,
    readonly authorType: string,
    readonly correlationId?: string,
  ) {}
}

export class MessageSentEvent implements DomainEvent {
  readonly eventName = 'MessageSent';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly messageId: string,
    readonly authorId: string,
    readonly authorType: string,
    readonly correlationId?: string,
  ) {}
}

export class ConversationStatusChangedEvent implements DomainEvent {
  readonly eventName = 'ConversationStatusChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly fromStatus: string,
    readonly toStatus: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class ConversationPriorityChangedEvent implements DomainEvent {
  readonly eventName = 'ConversationPriorityChanged';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly fromPriority: string,
    readonly toPriority: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class ConversationEscalatedEvent implements DomainEvent {
  readonly eventName = 'ConversationEscalated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly actorId: string,
    readonly reason: string | undefined,
    readonly correlationId?: string,
  ) {}
}

export class AgentAssignedEvent implements DomainEvent {
  readonly eventName = 'AgentAssigned';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly assignedAgentId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AgentUnassignedEvent implements DomainEvent {
  readonly eventName = 'AgentUnassigned';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class ConversationNoteAddedEvent implements DomainEvent {
  readonly eventName = 'ConversationNoteAdded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly noteId: string,
    readonly authorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AttachmentUploadedEvent implements DomainEvent {
  readonly eventName = 'AttachmentUploaded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly attachmentId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class MessageFeedbackSubmittedEvent implements DomainEvent {
  readonly eventName = 'MessageFeedbackSubmitted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly conversationId: string,
    readonly messageId: string,
    readonly rating: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}
