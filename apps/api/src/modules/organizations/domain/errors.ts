import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';

  constructor() {
    super('Enter a valid email address', 400);
  }
}

export class InvalidOrganizationNameError extends DomainError {
  readonly code = 'INVALID_ORGANIZATION_NAME';

  constructor() {
    super('Organization name must be between 1 and 80 characters', 400);
  }
}

export class InvalidOrganizationSlugError extends DomainError {
  readonly code = 'INVALID_ORGANIZATION_SLUG';

  constructor() {
    super('Slug must be 3-48 lowercase letters, numbers, or hyphens', 400);
  }
}

export class OrganizationSlugTakenError extends DomainError {
  readonly code = 'ORGANIZATION_SLUG_TAKEN';

  constructor() {
    super('That organization slug is already in use', 409);
  }
}

export class OrganizationNotFoundError extends DomainError {
  readonly code = 'ORGANIZATION_NOT_FOUND';

  constructor() {
    super('Organization not found', 404);
  }
}

export class OrganizationDisabledError extends DomainError {
  readonly code = 'ORGANIZATION_DISABLED';

  constructor() {
    super('This organization is disabled', 403);
  }
}

export class UnauthorizedOrganizationAccessError extends DomainError {
  readonly code = 'UNAUTHORIZED_ORGANIZATION_ACCESS';

  constructor() {
    super('You do not have access to this organization', 403);
  }
}

export class TenantContextRequiredError extends DomainError {
  readonly code = 'TENANT_CONTEXT_REQUIRED';

  constructor() {
    super('Select an organization to continue', 400);
  }
}

export class TenantMismatchError extends DomainError {
  readonly code = 'TENANT_MISMATCH';

  constructor() {
    super('The selected organization does not match this request', 403);
  }
}

export class InsufficientPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidOrganizationRoleError extends DomainError {
  readonly code = 'INVALID_ORGANIZATION_ROLE';

  constructor() {
    super('Choose a valid organization role', 400);
  }
}

export class CannotInviteOwnerError extends DomainError {
  readonly code = 'CANNOT_INVITE_OWNER';

  constructor() {
    super('Owners cannot be invited. Transfer ownership after the member joins.', 400);
  }
}

export class InvitationAlreadyPendingError extends DomainError {
  readonly code = 'INVITATION_ALREADY_PENDING';

  constructor() {
    super('A pending invitation already exists for this email', 409);
  }
}

export class AlreadyOrganizationMemberError extends DomainError {
  readonly code = 'ALREADY_ORGANIZATION_MEMBER';

  constructor() {
    super('This person is already a member of the organization', 409);
  }
}

export class InvitationNotFoundError extends DomainError {
  readonly code = 'INVITATION_NOT_FOUND';

  constructor() {
    super('Invitation not found', 404);
  }
}

export class InvalidInvitationTokenError extends DomainError {
  readonly code = 'INVALID_INVITATION_TOKEN';

  constructor() {
    super('Invitation link is invalid or expired', 400);
  }
}

export class InvitationEmailMismatchError extends DomainError {
  readonly code = 'INVITATION_EMAIL_MISMATCH';

  constructor() {
    super('Sign in with the invited email address to accept this invitation', 403);
  }
}

export class MembershipNotFoundError extends DomainError {
  readonly code = 'MEMBERSHIP_NOT_FOUND';

  constructor() {
    super('Member not found in this organization', 404);
  }
}

export class LastOwnerError extends DomainError {
  readonly code = 'LAST_OWNER';

  constructor() {
    super('The organization must keep at least one owner', 409);
  }
}

export class CannotChangeOwnRoleError extends DomainError {
  readonly code = 'CANNOT_CHANGE_OWN_ROLE';

  constructor() {
    super('You cannot change your own role', 400);
  }
}

export class CannotManageOwnerError extends DomainError {
  readonly code = 'CANNOT_MANAGE_OWNER';

  constructor() {
    super('Only an owner can change or remove another owner', 403);
  }
}
