import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientTicketPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class InvalidTicketError extends DomainError {
  readonly code = 'INVALID_TICKET';

  constructor(message: string) {
    super(message, 400);
  }
}

export class InvalidTicketStateError extends DomainError {
  readonly code = 'INVALID_TICKET_STATE';

  constructor(message: string) {
    super(message, 400);
  }
}

export class TicketNotFoundError extends DomainError {
  readonly code = 'TICKET_NOT_FOUND';

  constructor() {
    super('Ticket not found', 404);
  }
}

export class DuplicateOpenTicketError extends DomainError {
  readonly code = 'DUPLICATE_OPEN_TICKET';

  constructor() {
    super('An open ticket already exists for this conversation', 409);
  }
}

export class DuplicateSlaPolicyError extends DomainError {
  readonly code = 'DUPLICATE_SLA_POLICY';

  constructor() {
    super('An SLA policy already exists for that priority in this organization', 409);
  }
}

export class TicketSlaPolicyNotFoundError extends DomainError {
  readonly code = 'TICKET_SLA_POLICY_NOT_FOUND';

  constructor() {
    super('SLA policy not found', 404);
  }
}

export class TicketEscalationPolicyNotFoundError extends DomainError {
  readonly code = 'TICKET_ESCALATION_POLICY_NOT_FOUND';

  constructor() {
    super('Ticket escalation policy not found', 404);
  }
}

export class AssigneeNotOrganizationMemberError extends DomainError {
  readonly code = 'ASSIGNEE_NOT_ORGANIZATION_MEMBER';

  constructor() {
    super('Assignee must be an active member of this organization', 400);
  }
}

export class AssigneeNotAssignableError extends DomainError {
  readonly code = 'ASSIGNEE_NOT_ASSIGNABLE';

  constructor() {
    super('Only owners, admins, and agents can be assigned tickets', 400);
  }
}

export class NoAvailableAgentError extends DomainError {
  readonly code = 'NO_AVAILABLE_AGENT';

  constructor() {
    super('No online agent is available to take this ticket', 409);
  }
}

export class InvalidAttachmentError extends DomainError {
  readonly code = 'INVALID_ATTACHMENT';

  constructor(message: string) {
    super(message, 400);
  }
}

export class TicketAttachmentNotFoundError extends DomainError {
  readonly code = 'TICKET_ATTACHMENT_NOT_FOUND';

  constructor() {
    super('Ticket attachment not found', 404);
  }
}

export class TooManyTicketRecordsError extends DomainError {
  readonly code = 'TOO_MANY_TICKET_RECORDS';

  constructor(resource: string) {
    super(`This organization already has the maximum number of ${resource}`, 409);
  }
}

export class ConversationNotFoundForTicketError extends DomainError {
  readonly code = 'CONVERSATION_NOT_FOUND';

  constructor() {
    super('Conversation not found', 404);
  }
}
