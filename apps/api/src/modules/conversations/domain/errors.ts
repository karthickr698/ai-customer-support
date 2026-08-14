import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class ConversationNotFoundError extends DomainError {
  readonly code = 'CONVERSATION_NOT_FOUND';

  constructor() {
    super('Conversation not found', 404);
  }
}

export class UnauthorizedConversationAccessError extends DomainError {
  readonly code = 'UNAUTHORIZED_CONVERSATION_ACCESS';

  constructor() {
    super('You do not have access to this conversation', 403);
  }
}

export class InsufficientConversationPermissionError extends DomainError {
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

export class InvalidConversationStatusError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_STATUS';

  constructor() {
    super('Choose a valid conversation status', 400);
  }
}

export class InvalidConversationStateError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_STATE';

  constructor(message = 'This conversation cannot move to that status') {
    super(message, 409);
  }
}

export class ConversationClosedError extends DomainError {
  readonly code = 'CONVERSATION_CLOSED';

  constructor() {
    super('Closed conversations cannot accept new messages. Reopen the conversation first.', 409);
  }
}

export class InvalidConversationSubjectError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_SUBJECT';

  constructor() {
    super('Subject must be between 1 and 200 characters', 400);
  }
}

export class InvalidCustomerNameError extends DomainError {
  readonly code = 'INVALID_CUSTOMER_NAME';

  constructor() {
    super('Customer name must be between 1 and 80 characters', 400);
  }
}

export class InvalidCustomerEmailError extends DomainError {
  readonly code = 'INVALID_CUSTOMER_EMAIL';

  constructor() {
    super('Enter a valid customer email address', 400);
  }
}

export class InvalidConversationChannelError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_CHANNEL';

  constructor() {
    super('Channel must be web, email, api, or widget', 400);
  }
}

export class InvalidConversationTagError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_TAG';

  constructor() {
    super('Tags must be 1-32 lowercase letters, numbers, or hyphens', 400);
  }
}

export class ConversationTagAlreadyExistsError extends DomainError {
  readonly code = 'CONVERSATION_TAG_ALREADY_EXISTS';

  constructor() {
    super('That tag is already on this conversation', 409);
  }
}

export class ConversationTagNotFoundError extends DomainError {
  readonly code = 'CONVERSATION_TAG_NOT_FOUND';

  constructor() {
    super('Tag not found on this conversation', 404);
  }
}

export class TooManyConversationTagsError extends DomainError {
  readonly code = 'TOO_MANY_CONVERSATION_TAGS';

  constructor() {
    super('A conversation can have at most 20 tags', 400);
  }
}

export class InvalidMessageBodyError extends DomainError {
  readonly code = 'INVALID_MESSAGE_BODY';

  constructor() {
    super('Message body must be between 1 and 10000 characters', 400);
  }
}

export class InvalidMessageAuthorTypeError extends DomainError {
  readonly code = 'INVALID_MESSAGE_AUTHOR_TYPE';

  constructor() {
    super('Message author type must be customer, agent, system, or ai', 400);
  }
}

export class InvalidConversationNoteError extends DomainError {
  readonly code = 'INVALID_CONVERSATION_NOTE';

  constructor() {
    super('Note body must be between 1 and 5000 characters', 400);
  }
}

export class AssigneeNotOrganizationMemberError extends DomainError {
  readonly code = 'ASSIGNEE_NOT_ORGANIZATION_MEMBER';

  constructor() {
    super('The assignee must be an active member of this organization', 400);
  }
}

export class AssigneeNotAssignableError extends DomainError {
  readonly code = 'ASSIGNEE_NOT_ASSIGNABLE';

  constructor() {
    super('Conversations can only be assigned to owners, admins, or agents', 400);
  }
}

export class NoAvailableAgentError extends DomainError {
  readonly code = 'NO_AVAILABLE_AGENT';

  constructor() {
    super('No online agent is available for assignment', 409);
  }
}

export class EscalationRuleNotFoundError extends DomainError {
  readonly code = 'ESCALATION_RULE_NOT_FOUND';

  constructor() {
    super('Escalation rule not found', 404);
  }
}

export class InvalidEscalationRuleError extends DomainError {
  readonly code = 'INVALID_ESCALATION_RULE';

  constructor(message = 'Escalation rule is invalid') {
    super(message, 400);
  }
}

export class InvalidAttachmentError extends DomainError {
  readonly code = 'INVALID_ATTACHMENT';

  constructor(message = 'Attachment is invalid') {
    super(message, 400);
  }
}

export class AttachmentNotFoundError extends DomainError {
  readonly code = 'ATTACHMENT_NOT_FOUND';

  constructor() {
    super('Attachment not found', 404);
  }
}

export class AttachmentsNotAllowedError extends DomainError {
  readonly code = 'ATTACHMENTS_NOT_ALLOWED';

  constructor() {
    super('Attachments are disabled for this widget', 403);
  }
}

export class WidgetSessionRequiredError extends DomainError {
  readonly code = 'WIDGET_SESSION_REQUIRED';

  constructor() {
    super('A widget session is required', 401);
  }
}

export class EmptyMessageError extends DomainError {
  readonly code = 'EMPTY_MESSAGE';

  constructor() {
    super('Send a message body or at least one attachment', 400);
  }
}
