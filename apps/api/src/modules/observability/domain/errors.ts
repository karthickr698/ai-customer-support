import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientObservabilityPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidObservabilityError extends DomainError {
  readonly code = 'INVALID_OBSERVABILITY';

  constructor(message: string) {
    super(message, 400);
  }
}

export class ObservabilityTraceNotFoundError extends DomainError {
  readonly code = 'OBSERVABILITY_TRACE_NOT_FOUND';

  constructor() {
    super('Trace not found', 404);
  }
}

export class ObservabilityIncidentNotFoundError extends DomainError {
  readonly code = 'OBSERVABILITY_INCIDENT_NOT_FOUND';

  constructor() {
    super('Incident not found', 404);
  }
}

export class ObservabilityEvaluationNotFoundError extends DomainError {
  readonly code = 'OBSERVABILITY_EVALUATION_NOT_FOUND';

  constructor() {
    super('AI evaluation not found', 404);
  }
}

export class InvalidIncidentStateError extends DomainError {
  readonly code = 'INVALID_INCIDENT_STATE';

  constructor(message = 'This incident cannot be updated in its current state') {
    super(message, 409);
  }
}
