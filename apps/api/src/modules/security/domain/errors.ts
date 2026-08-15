import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientSecurityPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidSecurityError extends DomainError {
  readonly code = 'INVALID_SECURITY';

  constructor(message: string) {
    super(message, 400);
  }
}

export class SecurityPolicyNotFoundError extends DomainError {
  readonly code = 'SECURITY_POLICY_NOT_FOUND';

  constructor() {
    super('Security policy not found', 404);
  }
}

export class SecuritySecretNotFoundError extends DomainError {
  readonly code = 'SECURITY_SECRET_NOT_FOUND';

  constructor() {
    super('Secret not found', 404);
  }
}

export class SecuritySecretRevokedError extends DomainError {
  readonly code = 'SECURITY_SECRET_REVOKED';

  constructor() {
    super('Secret has been revoked', 410);
  }
}

export class DuplicateSecuritySecretError extends DomainError {
  readonly code = 'DUPLICATE_SECURITY_SECRET';

  constructor() {
    super('A secret with that name already exists', 409);
  }
}

export class SecurityIpAllowlistEntryNotFoundError extends DomainError {
  readonly code = 'SECURITY_IP_ALLOWLIST_ENTRY_NOT_FOUND';

  constructor() {
    super('IP allowlist entry not found', 404);
  }
}

export class DuplicateSecurityIpAllowlistEntryError extends DomainError {
  readonly code = 'DUPLICATE_SECURITY_IP_ALLOWLIST_ENTRY';

  constructor() {
    super('That CIDR is already on the allowlist', 409);
  }
}

export class IpNotAllowedError extends DomainError {
  readonly code = 'IP_NOT_ALLOWED';

  constructor() {
    super('This IP address is not allowed for this organization', 403);
  }
}

export class TooManySecurityRecordsError extends DomainError {
  readonly code = 'TOO_MANY_SECURITY_RECORDS';

  constructor(message: string) {
    super(message, 409);
  }
}

export class UnreadableSecuritySecretError extends DomainError {
  readonly code = 'UNREADABLE_SECURITY_SECRET';

  constructor() {
    super('Stored secret is unreadable', 500);
  }
}

export class InvalidSecurityEnvelopeError extends DomainError {
  readonly code = 'INVALID_SECURITY_ENVELOPE';

  constructor(message = 'Encryption envelope is invalid') {
    super(message, 400);
  }
}

export class UnsupportedMediaTypeError extends DomainError {
  readonly code = 'UNSUPPORTED_MEDIA_TYPE';

  constructor(message = 'Content-Type must be application/json') {
    super(message, 415);
  }
}

export class PayloadTooLargeError extends DomainError {
  readonly code = 'PAYLOAD_TOO_LARGE';

  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`, 413);
  }
}
