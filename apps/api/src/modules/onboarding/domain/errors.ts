import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientOnboardingPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidOnboardingStateError extends DomainError {
  readonly code = 'INVALID_ONBOARDING_STATE';

  constructor(message: string) {
    super(message, 400);
  }
}

export class InvalidSupportToneError extends DomainError {
  readonly code = 'INVALID_SUPPORT_TONE';

  constructor() {
    super('Choose a generated support-tone preset', 400);
  }
}

export class OnboardingNotFoundError extends DomainError {
  readonly code = 'ONBOARDING_NOT_FOUND';

  constructor() {
    super('Onboarding setup was not found', 404);
  }
}

export class BusinessProfileRequiredError extends DomainError {
  readonly code = 'BUSINESS_PROFILE_REQUIRED';

  constructor() {
    super('Generate a business profile before this step', 409);
  }
}
