import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientKnowledgePermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidKnowledgeSourceError extends DomainError {
  readonly code = 'INVALID_KNOWLEDGE_SOURCE';

  constructor(message: string) {
    super(message, 400);
  }
}

export class KnowledgeSourceNotFoundError extends DomainError {
  readonly code = 'KNOWLEDGE_SOURCE_NOT_FOUND';

  constructor() {
    super('Knowledge source not found', 404);
  }
}

export class TooManyKnowledgeSourcesError extends DomainError {
  readonly code = 'TOO_MANY_KNOWLEDGE_SOURCES';

  constructor() {
    super('This organization already has the maximum number of knowledge sources', 409);
  }
}

export class InvalidKnowledgeDocumentError extends DomainError {
  readonly code = 'INVALID_KNOWLEDGE_DOCUMENT';

  constructor(message: string) {
    super(message, 400);
  }
}

export class KnowledgeDocumentNotFoundError extends DomainError {
  readonly code = 'KNOWLEDGE_DOCUMENT_NOT_FOUND';

  constructor() {
    super('Knowledge document not found', 404);
  }
}

export class InvalidKnowledgeDocumentStateError extends DomainError {
  readonly code = 'INVALID_KNOWLEDGE_DOCUMENT_STATE';

  constructor(message = 'This knowledge document cannot be updated in its current state') {
    super(message, 409);
  }
}

export class TooManyKnowledgeDocumentsError extends DomainError {
  readonly code = 'TOO_MANY_KNOWLEDGE_DOCUMENTS';

  constructor() {
    super('This organization already has the maximum number of knowledge documents', 409);
  }
}
