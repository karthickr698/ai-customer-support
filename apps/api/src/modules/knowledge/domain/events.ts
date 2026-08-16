import type { DomainEvent } from '@ai-customer-support/shared';

export class KnowledgeSourceRegisteredEvent implements DomainEvent {
  readonly eventName = 'KnowledgeSourceRegistered';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly knowledgeSourceId: string,
    readonly sourceType: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeSourceRemovedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeSourceRemoved';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly knowledgeSourceId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeDocumentUploadedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeDocumentUploaded';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly documentId: string,
    readonly kind: string,
    readonly version: number,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeDocumentProcessingRequestedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeDocumentProcessingRequested';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly documentId: string,
    readonly version: number,
    readonly replacePreviousVersion: boolean,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeDocumentProcessedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeDocumentProcessed';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly documentId: string,
    readonly version: number,
    readonly chunkCount: number,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeDocumentRemovedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeDocumentRemoved';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly documentId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class AIProcessingFailedEvent implements DomainEvent {
  readonly eventName = 'AIProcessingFailed';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly documentId: string,
    readonly version: number,
    readonly failureCode: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeArticleCreatedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeArticleCreated';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly articleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeArticlePublishedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeArticlePublished';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly articleId: string,
    readonly version: number,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeArticleUnpublishedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeArticleUnpublished';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly articleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeArticleArchivedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeArticleArchived';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly articleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}

export class KnowledgeArticleDeletedEvent implements DomainEvent {
  readonly eventName = 'KnowledgeArticleDeleted';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly articleId: string,
    readonly actorId: string,
    readonly correlationId?: string,
  ) {}
}
