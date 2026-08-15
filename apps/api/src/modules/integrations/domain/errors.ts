import { DomainError } from '@ai-customer-support/shared';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class InsufficientIntegrationPermissionError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSION';

  constructor(permission?: string) {
    super(
      permission ? `Missing permission: ${permission}` : 'You do not have permission to perform this action',
      403,
    );
  }
}

export class UnknownToolError extends DomainError {
  readonly code = 'UNKNOWN_TOOL';

  constructor(name?: string) {
    super(name ? `Unknown tool: ${name}` : 'Unknown tool', 400);
  }
}

export class InvalidToolCallError extends DomainError {
  readonly code = 'INVALID_TOOL_CALL';

  constructor(message: string) {
    super(message, 400);
  }
}

export class ToolNotAllowlistedError extends DomainError {
  readonly code = 'TOOL_NOT_ALLOWLISTED';

  constructor() {
    super('This tool is not on the allowlist', 403);
  }
}

export class ToolCredentialRequiredError extends DomainError {
  readonly code = 'TOOL_CREDENTIAL_REQUIRED';

  constructor() {
    super('This tool requires a tenant credential or connected OAuth connector', 409);
  }
}

export class InvalidIntegrationCredentialError extends DomainError {
  readonly code = 'INVALID_INTEGRATION_CREDENTIAL';

  constructor(message: string) {
    super(message, 400);
  }
}

export class IntegrationCredentialNotFoundError extends DomainError {
  readonly code = 'INTEGRATION_CREDENTIAL_NOT_FOUND';

  constructor() {
    super('Integration credential not found', 404);
  }
}

export class InvalidOAuthConnectorError extends DomainError {
  readonly code = 'INVALID_OAUTH_CONNECTOR';

  constructor(message: string) {
    super(message, 400);
  }
}

export class OAuthConnectorNotFoundError extends DomainError {
  readonly code = 'OAUTH_CONNECTOR_NOT_FOUND';

  constructor() {
    super('OAuth connector not found', 404);
  }
}

export class OAuthConnectorNotConfiguredError extends DomainError {
  readonly code = 'OAUTH_CONNECTOR_NOT_CONFIGURED';

  constructor() {
    super('OAuth redirect URI is not configured', 503);
  }
}

export class OAuthConnectorFailedError extends DomainError {
  readonly code = 'OAUTH_CONNECTOR_FAILED';

  constructor(message = 'The OAuth connector could not complete authorization') {
    super(message, 400);
  }
}

export class ToolInvocationNotFoundError extends DomainError {
  readonly code = 'TOOL_INVOCATION_NOT_FOUND';

  constructor() {
    super('Tool invocation not found', 404);
  }
}

export class ToolExecutionError extends DomainError {
  readonly code = 'TOOL_EXECUTION_FAILED';

  constructor(message = 'The tool call failed') {
    super(message, 502);
  }
}

export class ToolTimeoutError extends DomainError {
  readonly code = 'TOOL_TIMEOUT';

  constructor() {
    super('The tool call timed out', 504);
  }
}

export class UnsafeIntegrationUrlError extends DomainError {
  readonly code = 'UNSAFE_INTEGRATION_URL';

  constructor(message = 'This URL cannot be used for an integration') {
    super(message, 400);
  }
}

export class InvalidApiKeyError extends DomainError {
  readonly code = 'INVALID_API_KEY';

  constructor(message: string) {
    super(message, 400);
  }
}

export class ApiKeyNotFoundError extends DomainError {
  readonly code = 'API_KEY_NOT_FOUND';

  constructor() {
    super('API key not found', 404);
  }
}

export class ApiKeyLimitExceededError extends DomainError {
  readonly code = 'API_KEY_LIMIT_EXCEEDED';

  constructor() {
    super('This organization has reached the API key limit', 409);
  }
}

export class InvalidWebhookSubscriptionError extends DomainError {
  readonly code = 'INVALID_WEBHOOK_SUBSCRIPTION';

  constructor(message: string) {
    super(message, 400);
  }
}

export class WebhookSubscriptionNotFoundError extends DomainError {
  readonly code = 'WEBHOOK_SUBSCRIPTION_NOT_FOUND';

  constructor() {
    super('Webhook subscription not found', 404);
  }
}

export class WebhookLimitExceededError extends DomainError {
  readonly code = 'WEBHOOK_LIMIT_EXCEEDED';

  constructor() {
    super('This organization has reached the webhook subscription limit', 409);
  }
}

export class WebhookDeliveryNotFoundError extends DomainError {
  readonly code = 'WEBHOOK_DELIVERY_NOT_FOUND';

  constructor() {
    super('Webhook delivery not found', 404);
  }
}

export class InvalidOAuthApplicationError extends DomainError {
  readonly code = 'INVALID_OAUTH_APPLICATION';

  constructor(message: string) {
    super(message, 400);
  }
}

export class OAuthApplicationNotFoundError extends DomainError {
  readonly code = 'OAUTH_APPLICATION_NOT_FOUND';

  constructor() {
    super('OAuth application not found', 404);
  }
}

export class OAuthApplicationLimitExceededError extends DomainError {
  readonly code = 'OAUTH_APPLICATION_LIMIT_EXCEEDED';

  constructor() {
    super('This organization has reached the OAuth application limit', 409);
  }
}

export class OAuthAuthorizationDeniedError extends DomainError {
  readonly code = 'OAUTH_AUTHORIZATION_DENIED';

  constructor(message = 'The authorization request was denied') {
    super(message, 400);
  }
}

export class InvalidOAuthGrantError extends DomainError {
  readonly code = 'INVALID_OAUTH_GRANT';

  constructor(message = 'The OAuth grant is invalid or expired') {
    super(message, 400);
  }
}

export class UnsupportedApiVersionError extends DomainError {
  readonly code = 'UNSUPPORTED_API_VERSION';

  constructor() {
    super('Unsupported API version', 400);
  }
}
