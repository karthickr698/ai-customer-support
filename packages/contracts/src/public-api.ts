/**
 * Cross-runtime DTOs for the versioned public REST API, API keys, webhooks,
 * inbound OAuth applications, and outbound connector catalog.
 */

export const PUBLIC_API_VERSION = 'v1' as const;
export const PUBLIC_API_SCHEMA_VERSION = 2 as const;

export const API_KEY_STATUSES = ['active', 'revoked', 'expired'] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

export const PUBLIC_API_AUTH_KINDS = ['session', 'api_key', 'oauth_token'] as const;
export type PublicApiAuthKind = (typeof PUBLIC_API_AUTH_KINDS)[number];

export const WEBHOOK_STATUSES = ['active', 'paused', 'disabled'] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'succeeded', 'failed', 'abandoned'] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const WEBHOOK_ATTEMPT_STATUSES = ['succeeded', 'failed'] as const;
export type WebhookAttemptStatus = (typeof WEBHOOK_ATTEMPT_STATUSES)[number];

export const WEBHOOK_EVENT_NAMES = [
  'conversation.created',
  'conversation.updated',
  'conversation.message.created',
  'conversation.escalated',
  'conversation.assigned',
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.escalated',
  'tool.call.executed',
  'oauth.connector.connected',
  'oauth.connector.disconnected',
  'integration.credential.upserted',
  'integration.credential.revoked',
  'api_key.created',
  'api_key.revoked',
  'webhook.created',
] as const;
export type WebhookEventName = (typeof WEBHOOK_EVENT_NAMES)[number];

export const CONNECTOR_KINDS = ['http', 'oauth'] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export const CONNECTOR_AUTH_KINDS = ['api_key', 'oauth'] as const;
export type ConnectorAuthKind = (typeof CONNECTOR_AUTH_KINDS)[number];

export const CONNECTOR_CONNECTION_STATUSES = [
  'connected',
  'pending',
  'expired',
  'disconnected',
] as const;
export type ConnectorConnectionStatus = (typeof CONNECTOR_CONNECTION_STATUSES)[number];

export const OAUTH_APPLICATION_STATUSES = ['active', 'revoked'] as const;
export type OAuthApplicationStatus = (typeof OAUTH_APPLICATION_STATUSES)[number];

export const OAUTH_TOKEN_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
export type OAuthTokenGrantType = (typeof OAUTH_TOKEN_GRANT_TYPES)[number];

export type PublicApiVersionResponse = {
  readonly apiVersion: typeof PUBLIC_API_VERSION;
  readonly schemaVersion: typeof PUBLIC_API_SCHEMA_VERSION;
  readonly documentationUrl: string;
  readonly openApiUrl: string;
};

export type PublicApiSessionResponse = {
  readonly apiVersion: typeof PUBLIC_API_VERSION;
  readonly organizationId: string;
  readonly auth: {
    readonly kind: PublicApiAuthKind;
    readonly scopes: readonly string[];
  };
};

export type OrganizationApiKeyDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: readonly string[];
  readonly status: ApiKeyStatus;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
};

export type CreateOrganizationApiKeyRequest = {
  readonly name: string;
  readonly scopes?: readonly string[];
  readonly expiresAt?: string;
};

export type OrganizationApiKeyCreatedResponse = {
  readonly apiKey: OrganizationApiKeyDto;
  readonly token: string;
};

export type OrganizationApiKeyResponse = {
  readonly apiKey: OrganizationApiKeyDto;
};

export type OrganizationApiKeyListResponse = {
  readonly items: readonly OrganizationApiKeyDto[];
};

export type WebhookSubscriptionDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly url: string;
  readonly description: string | null;
  readonly events: readonly WebhookEventName[];
  readonly status: WebhookStatus;
  readonly secretLastFour: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateWebhookSubscriptionRequest = {
  readonly url: string;
  readonly events: readonly WebhookEventName[];
  readonly description?: string;
};

export type UpdateWebhookSubscriptionRequest = {
  readonly url?: string;
  readonly events?: readonly WebhookEventName[];
  readonly description?: string;
  readonly status?: Exclude<WebhookStatus, 'disabled'>;
};

export type WebhookSubscriptionCreatedResponse = {
  readonly webhook: WebhookSubscriptionDto;
  readonly secret: string;
};

export type WebhookSubscriptionResponse = {
  readonly webhook: WebhookSubscriptionDto;
};

export type WebhookSubscriptionListResponse = {
  readonly items: readonly WebhookSubscriptionDto[];
};

export type WebhookSecretRotatedResponse = {
  readonly webhook: WebhookSubscriptionDto;
  readonly secret: string;
};

export type WebhookDeliveryDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly subscriptionId: string;
  readonly eventName: WebhookEventName;
  readonly status: WebhookDeliveryStatus;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly responseStatus: number | null;
  readonly errorMessage: string | null;
  readonly nextAttemptAt: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
};

export type WebhookDeliveryListResponse = {
  readonly items: readonly WebhookDeliveryDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type WebhookDeliveryResponse = {
  readonly delivery: WebhookDeliveryDto;
};

export type WebhookDeliveryDetailResponse = {
  readonly delivery: WebhookDeliveryDto;
  readonly payload: Record<string, unknown>;
};

export type WebhookDeliveryAttemptDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly deliveryId: string;
  readonly attempt: number;
  readonly status: WebhookAttemptStatus;
  readonly responseStatus: number | null;
  readonly durationMs: number;
  readonly signatureTimestamp: number;
  readonly signatureHeader: string;
  readonly errorMessage: string | null;
  readonly responseBodyPreview: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type WebhookDeliveryAttemptListResponse = {
  readonly items: readonly WebhookDeliveryAttemptDto[];
};

export type VerifyWebhookSignatureRequest = {
  readonly signatureHeader: string;
  readonly body: string;
  readonly toleranceSeconds?: number;
};

export type VerifyWebhookSignatureResponse = {
  readonly valid: boolean;
  readonly timestamp: number | null;
  readonly reason: string | null;
};

export type DispatchWebhooksResponse = {
  readonly retried: number;
};

export type PublicApiUsageRecordDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly actorId: string | null;
  readonly authKind: PublicApiAuthKind;
  readonly credentialId: string | null;
  readonly method: string;
  readonly path: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly requestId: string | null;
  readonly occurredAt: string;
};

export type PublicApiUsageListResponse = {
  readonly items: readonly PublicApiUsageRecordDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type PublicApiUsageRouteCountDto = {
  readonly method: string;
  readonly route: string;
  readonly count: number;
  readonly errorCount: number;
  readonly averageDurationMs: number;
};

export type PublicApiUsageStatusCountDto = {
  readonly statusClass: string;
  readonly count: number;
};

export type PublicApiUsageAuthCountDto = {
  readonly authKind: PublicApiAuthKind;
  readonly count: number;
};

export type PublicApiUsageDayCountDto = {
  readonly date: string;
  readonly count: number;
  readonly errorCount: number;
};

export type PublicApiUsageSummaryResponse = {
  readonly from: string;
  readonly to: string;
  readonly totalRequests: number;
  readonly errorCount: number;
  readonly averageDurationMs: number;
  readonly byRoute: readonly PublicApiUsageRouteCountDto[];
  readonly byStatus: readonly PublicApiUsageStatusCountDto[];
  readonly byAuthKind: readonly PublicApiUsageAuthCountDto[];
  readonly byDay: readonly PublicApiUsageDayCountDto[];
};

export type ConnectorDefinitionDto = {
  readonly provider: string;
  readonly kind: ConnectorKind;
  readonly authKind: ConnectorAuthKind;
  readonly name: string;
  readonly description: string;
  readonly defaultAuthorizationUrl: string | null;
  readonly defaultTokenUrl: string | null;
};

export type ConnectorCatalogResponse = {
  readonly items: readonly ConnectorDefinitionDto[];
};

export type ConnectorConnectionDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly kind: ConnectorKind;
  readonly provider: string;
  readonly name: string;
  readonly status: ConnectorConnectionStatus;
  readonly toolName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ConnectorConnectionListResponse = {
  readonly items: readonly ConnectorConnectionDto[];
};

export type OrganizationOAuthApplicationDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly clientId: string;
  readonly clientSecretLastFour: string;
  readonly redirectUris: readonly string[];
  readonly scopes: readonly string[];
  readonly status: OAuthApplicationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateOAuthApplicationRequest = {
  readonly name: string;
  readonly redirectUris: readonly string[];
  readonly scopes?: readonly string[];
};

export type OAuthApplicationCreatedResponse = {
  readonly application: OrganizationOAuthApplicationDto;
  readonly clientSecret: string;
};

export type OAuthApplicationResponse = {
  readonly application: OrganizationOAuthApplicationDto;
};

export type OAuthApplicationListResponse = {
  readonly items: readonly OrganizationOAuthApplicationDto[];
};

export type OAuthAuthorizationConsentResponse = {
  readonly application: {
    readonly id: string;
    readonly name: string;
    readonly organizationId: string;
  };
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly state: string;
};

export type ApproveOAuthAuthorizationRequest = {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly scope?: string;
  readonly approve?: boolean;
};

export type ApproveOAuthAuthorizationResponse = {
  readonly redirectUrl: string;
};

export type ExchangeOAuthTokenRequest = {
  readonly grantType: OAuthTokenGrantType;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly code?: string;
  readonly codeVerifier?: string;
  readonly redirectUri?: string;
  readonly refreshToken?: string;
};

export type OAuthTokenResponse = {
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly scope: string;
};

export function isWebhookEventName(value: unknown): value is WebhookEventName {
  return typeof value === 'string' && (WEBHOOK_EVENT_NAMES as readonly string[]).includes(value);
}
