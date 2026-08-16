import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientAiAgentPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission
        ? `Missing permission: ${permission}`
        : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidAiAgentConfigurationError extends DomainError {
  readonly code = 'INVALID_AI_AGENT_CONFIGURATION';

  constructor(message: string) {
    super(message, 400);
  }
}
