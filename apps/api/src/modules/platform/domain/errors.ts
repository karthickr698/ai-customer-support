import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientPlatformPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidPlatformError extends DomainError {
  readonly code = 'INVALID_PLATFORM';

  constructor(message: string) {
    super(message, 400);
  }
}

export class PlatformOperatorNotFoundError extends DomainError {
  readonly code = 'PLATFORM_OPERATOR_NOT_FOUND';

  constructor() {
    super('Platform operator not found', 404);
  }
}

export class DuplicatePlatformOperatorError extends DomainError {
  readonly code = 'DUPLICATE_PLATFORM_OPERATOR';

  constructor() {
    super('That user is already a platform operator', 409);
  }
}

export class LastPlatformOwnerError extends DomainError {
  readonly code = 'LAST_PLATFORM_OWNER';

  constructor() {
    super('The platform must keep at least one owner', 409);
  }
}

export class CannotChangeOwnPlatformRoleError extends DomainError {
  readonly code = 'CANNOT_CHANGE_OWN_PLATFORM_ROLE';

  constructor() {
    super('You cannot change your own platform role', 400);
  }
}

export class CannotManagePlatformOwnerError extends DomainError {
  readonly code = 'CANNOT_MANAGE_PLATFORM_OWNER';

  constructor() {
    super('Only a platform owner can grant, change, or revoke another owner', 403);
  }
}

export class PlatformUserNotEligibleError extends DomainError {
  readonly code = 'PLATFORM_USER_NOT_ELIGIBLE';

  constructor(message = 'That user cannot be granted platform access') {
    super(message, 400);
  }
}

export class PlatformBootstrapUnavailableError extends DomainError {
  readonly code = 'PLATFORM_BOOTSTRAP_UNAVAILABLE';

  constructor(message = 'Platform bootstrap is not available') {
    super(message, 409);
  }
}

export class PlatformTenantNotFoundError extends DomainError {
  readonly code = 'PLATFORM_TENANT_NOT_FOUND';

  constructor() {
    super('Tenant not found', 404);
  }
}

export class FeatureFlagNotFoundError extends DomainError {
  readonly code = 'FEATURE_FLAG_NOT_FOUND';

  constructor() {
    super('Feature flag not found', 404);
  }
}

export class DuplicateFeatureFlagError extends DomainError {
  readonly code = 'DUPLICATE_FEATURE_FLAG';

  constructor() {
    super('A feature flag with that key already exists', 409);
  }
}

export class FeatureFlagOverrideNotFoundError extends DomainError {
  readonly code = 'FEATURE_FLAG_OVERRIDE_NOT_FOUND';

  constructor() {
    super('Feature flag override not found', 404);
  }
}
