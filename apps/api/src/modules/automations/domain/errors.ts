import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientAutomationPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidAutomationError extends DomainError {
  readonly code = 'INVALID_AUTOMATION';

  constructor(message: string) {
    super(message, 400);
  }
}

export class InvalidAutomationStateError extends DomainError {
  readonly code = 'INVALID_AUTOMATION_STATE';

  constructor(message: string) {
    super(message, 400);
  }
}

export class AutomationRuleNotFoundError extends DomainError {
  readonly code = 'AUTOMATION_RULE_NOT_FOUND';

  constructor() {
    super('Automation rule not found', 404);
  }
}

export class AutomationJobNotFoundError extends DomainError {
  readonly code = 'AUTOMATION_JOB_NOT_FOUND';

  constructor() {
    super('Automation job not found', 404);
  }
}

export class DuplicateAutomationJobError extends DomainError {
  readonly code = 'DUPLICATE_AUTOMATION_JOB';

  constructor() {
    super('An automation job with that idempotency key already exists', 409);
  }
}

export class TooManyAutomationRecordsError extends DomainError {
  readonly code = 'TOO_MANY_AUTOMATION_RECORDS';

  constructor(resource: string) {
    super(`This organization already has the maximum number of ${resource}`, 409);
  }
}

export class UnsafeAutomationUrlError extends DomainError {
  readonly code = 'UNSAFE_AUTOMATION_URL';

  constructor(message: string) {
    super(message, 400);
  }
}

export class AutomationActionFailedError extends DomainError {
  readonly code = 'AUTOMATION_ACTION_FAILED';

  constructor(message: string) {
    super(message, 502);
  }
}
