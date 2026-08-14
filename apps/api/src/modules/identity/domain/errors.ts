import { DomainError } from '@ai-customer-support/shared';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';

  constructor() {
    super('Enter a valid email address', 400);
  }
}

export class WeakPasswordError extends DomainError {
  readonly code = 'WEAK_PASSWORD';

  constructor(message = 'Password does not meet the security policy') {
    super(message, 400);
  }
}

export class InvalidDisplayNameError extends DomainError {
  readonly code = 'INVALID_DISPLAY_NAME';

  constructor() {
    super('Display name must be between 1 and 80 characters', 400);
  }
}

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor() {
    super('An account with this email already exists', 409);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid email or password', 401);
  }
}

export class EmailNotVerifiedError extends DomainError {
  readonly code = 'EMAIL_NOT_VERIFIED';

  constructor() {
    super('Verify your email before signing in', 403);
  }
}

export class UserDisabledError extends DomainError {
  readonly code = 'USER_DISABLED';

  constructor() {
    super('This account has been disabled', 403);
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('User not found', 404);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';

  constructor() {
    super('Refresh token is invalid or expired', 401);
  }
}

export class RefreshTokenReuseDetectedError extends DomainError {
  readonly code = 'REFRESH_TOKEN_REUSE_DETECTED';

  constructor() {
    super('Refresh token reuse was detected. Sign in again.', 401);
  }
}

export class InvalidEmailVerificationTokenError extends DomainError {
  readonly code = 'INVALID_EMAIL_VERIFICATION_TOKEN';

  constructor() {
    super('Email verification link is invalid or expired', 400);
  }
}

export class InvalidPasswordResetTokenError extends DomainError {
  readonly code = 'INVALID_PASSWORD_RESET_TOKEN';

  constructor() {
    super('Password reset link is invalid or expired', 400);
  }
}

export class InvalidOAuthLoginCodeError extends DomainError {
  readonly code = 'INVALID_OAUTH_LOGIN_CODE';

  constructor() {
    super('Google sign-in could not be completed. Try again.', 401);
  }
}

export class GoogleOAuthNotConfiguredError extends DomainError {
  readonly code = 'GOOGLE_OAUTH_NOT_CONFIGURED';

  constructor() {
    super('Google sign-in is not configured', 503);
  }
}

export class GoogleOAuthFailedError extends DomainError {
  readonly code = 'GOOGLE_OAUTH_FAILED';

  constructor(message = 'Google sign-in failed') {
    super(message, 401);
  }
}
