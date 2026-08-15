/**
 * Cross-runtime DTOs for secure tool calling.
 * Python proposes and schema-validates calls. TypeScript authorizes, executes, and audits.
 */

export const TOOL_CALL_SCHEMA_VERSION = 1 as const;

export const TOOL_NAMES = [
  'getCustomerDetails',
  'getOrderDetails',
  'createTicket',
  'updateTicket',
  'checkRefundStatus',
  'handoffToAgent',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOL_SIDES = ['read', 'write'] as const;
export type ToolSide = (typeof TOOL_SIDES)[number];

export const TOOL_EXECUTION_KINDS = ['platform', 'http'] as const;
export type ToolExecutionKind = (typeof TOOL_EXECUTION_KINDS)[number];

export const TOOL_INVOCATION_STATUSES = [
  'accepted',
  'succeeded',
  'failed',
  'rejected',
  'timed_out',
] as const;
export type ToolInvocationStatus = (typeof TOOL_INVOCATION_STATUSES)[number];

export const TOOL_ACTOR_TYPES = ['user', 'ai'] as const;
export type ToolActorType = (typeof TOOL_ACTOR_TYPES)[number];

export const INTEGRATION_CREDENTIAL_KINDS = ['api_key', 'bearer'] as const;
export type IntegrationCredentialKind = (typeof INTEGRATION_CREDENTIAL_KINDS)[number];

export const OAUTH_CONNECTOR_PROVIDERS = ['shopify', 'stripe', 'zendesk', 'custom'] as const;
export type OAuthConnectorProvider = (typeof OAUTH_CONNECTOR_PROVIDERS)[number];

export const OAUTH_CONNECTOR_STATUSES = ['pending', 'connected', 'expired', 'disconnected'] as const;
export type OAuthConnectorStatus = (typeof OAUTH_CONNECTOR_STATUSES)[number];

export type JsonSchemaProperty = {
  readonly type: 'string' | 'number' | 'boolean' | 'integer';
  readonly description?: string;
  readonly format?: 'uuid' | 'email' | 'uri';
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly enum?: readonly string[];
};

export type ToolArgumentSchema = {
  readonly type: 'object';
  readonly additionalProperties: false;
  readonly required: readonly string[];
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>;
};

export type ToolRetryPolicyDto = {
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly backoffMs: number;
};

export type ToolDefinitionDto = {
  readonly name: ToolName;
  readonly description: string;
  readonly side: ToolSide;
  readonly executionKind: ToolExecutionKind;
  readonly permission: string;
  readonly retry: ToolRetryPolicyDto;
  readonly argumentSchema: ToolArgumentSchema;
};

export type ProposedToolCallDto = {
  readonly name: ToolName;
  readonly arguments: Record<string, unknown>;
};

export type ToolCallResultDto = {
  readonly name: ToolName;
  readonly ok: boolean;
  readonly data: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
};

export type ProposeToolCallsRequest = {
  readonly conversationId: string;
  readonly visitorMessage: string;
  readonly history?: readonly { readonly role: string; readonly content: string }[];
  readonly allowedTools?: readonly ToolName[];
};

export type ProposeToolCallsResponse = {
  readonly schemaVersion: typeof TOOL_CALL_SCHEMA_VERSION;
  readonly calls: readonly ProposedToolCallDto[];
  readonly reason: string | null;
};

export type ApplyToolResultsRequest = {
  readonly conversationId: string;
  readonly visitorMessage: string;
  readonly history?: readonly { readonly role: string; readonly content: string }[];
  readonly results: readonly ToolCallResultDto[];
};

export type ApplyToolResultsResponse = {
  readonly schemaVersion: typeof TOOL_CALL_SCHEMA_VERSION;
  readonly reply: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
};

export type ExecuteToolCallRequest = {
  readonly name: ToolName;
  readonly arguments: Record<string, unknown>;
  readonly conversationId?: string;
  readonly actorType?: ToolActorType;
};

export type ToolInvocationDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly toolName: ToolName;
  readonly conversationId: string | null;
  readonly actorId: string | null;
  readonly actorType: ToolActorType;
  readonly status: ToolInvocationStatus;
  readonly arguments: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly attemptCount: number;
  readonly durationMs: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
};

export type ExecuteToolCallResponse = {
  readonly invocation: ToolInvocationDto;
};

export type ToolDefinitionListResponse = {
  readonly items: readonly ToolDefinitionDto[];
};

export type ToolInvocationListResponse = {
  readonly items: readonly ToolInvocationDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type IntegrationCredentialDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly toolName: ToolName;
  readonly provider: string | null;
  readonly name: string;
  readonly kind: IntegrationCredentialKind;
  readonly headerName: string;
  readonly baseUrl: string;
  readonly secretLastFour: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type UpsertIntegrationCredentialRequest = {
  readonly toolName: ToolName;
  readonly name: string;
  readonly kind: IntegrationCredentialKind;
  readonly secret: string;
  readonly baseUrl: string;
  readonly headerName?: string;
  readonly provider?: string;
};

export type IntegrationCredentialResponse = {
  readonly credential: IntegrationCredentialDto;
};

export type IntegrationCredentialListResponse = {
  readonly items: readonly IntegrationCredentialDto[];
};

export type OAuthConnectorDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: OAuthConnectorProvider;
  readonly name: string;
  readonly status: OAuthConnectorStatus;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly tokenExpiresAt: string | null;
  readonly externalAccountId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type UpsertOAuthConnectorRequest = {
  readonly provider: OAuthConnectorProvider;
  readonly name: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly scopes?: readonly string[];
};

export type OAuthConnectorResponse = {
  readonly connector: OAuthConnectorDto;
};

export type OAuthConnectorListResponse = {
  readonly items: readonly OAuthConnectorDto[];
};

export type StartOAuthConnectorResponse = {
  readonly authorizationUrl: string;
};

export type CompleteOAuthConnectorRequest = {
  readonly code: string;
  readonly state: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isToolName(value: unknown): value is ToolName {
  return typeof value === 'string' && (TOOL_NAMES as readonly string[]).includes(value);
}

export function isProposedToolCallDto(value: unknown): value is ProposedToolCallDto {
  if (!isRecord(value)) {
    return false;
  }
  return isToolName(value.name) && isRecord(value.arguments);
}

export function isProposeToolCallsResponse(value: unknown): value is ProposeToolCallsResponse {
  if (!isRecord(value)) {
    return false;
  }
  const calls = value.calls;
  return (
    value.schemaVersion === TOOL_CALL_SCHEMA_VERSION &&
    Array.isArray(calls) &&
    calls.every(isProposedToolCallDto) &&
    (value.reason === null || typeof value.reason === 'string')
  );
}

export function isApplyToolResultsResponse(value: unknown): value is ApplyToolResultsResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schemaVersion === TOOL_CALL_SCHEMA_VERSION &&
    typeof value.reply === 'string' &&
    value.reply.trim().length > 0 &&
    typeof value.model === 'string' &&
    typeof value.promptTokens === 'number' &&
    typeof value.completionTokens === 'number'
  );
}

export function isToolCallResultDto(value: unknown): value is ToolCallResultDto {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isToolName(value.name) &&
    typeof value.ok === 'boolean' &&
    (value.data === null || isRecord(value.data)) &&
    (value.errorCode === null || typeof value.errorCode === 'string') &&
    (value.errorMessage === null || typeof value.errorMessage === 'string')
  );
}
