import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { ToolName } from '@ai-customer-support/contracts';
import type { OrganizationApiKey } from '../domain/api-key.js';
import type { PublicApiUsageRecord } from '../domain/api-usage-record.js';
import type { IntegrationCredential } from '../domain/integration-credential.js';
import type {
  IntegrationCredentialId,
  OAuthApplicationId,
  OAuthConnectorId,
  OAuthGrantId,
  OrganizationApiKeyId,
  PublicApiUsageId,
  ToolInvocationId,
  WebhookDeliveryAttemptId,
  WebhookDeliveryId,
  WebhookSubscriptionId,
} from '../domain/ids.js';
import type { OrganizationOAuthApplication } from '../domain/oauth-application.js';
import type { OAuthConnector } from '../domain/oauth-connector.js';
import type { OrganizationOAuthGrant } from '../domain/oauth-grant.js';
import type { ToolInvocation } from '../domain/tool-invocation.js';
import type { WebhookDelivery } from '../domain/webhook-delivery.js';
import type { WebhookDeliveryAttempt } from '../domain/webhook-delivery-attempt.js';
import type { WebhookSubscription } from '../domain/webhook-subscription.js';

export type IntegrationActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<IntegrationActor>;
}

export interface ClockPort {
  now(): Date;
}

export interface SecretCipherPort {
  encrypt(plaintext: string): { ciphertext: string; nonce: string };
  decrypt(ciphertext: string, nonce: string): string;
}

export interface SecureTokenGeneratorPort {
  generate(): string;
}

export interface TokenHasherPort {
  pkceS256Challenge(verifier: string): string;
}

export interface DigestHasherPort {
  hash(value: string): string;
}

export interface IntegrationCredentialRepository {
  save(credential: IntegrationCredential): Promise<void>;
  findById(tenantId: string, credentialId: IntegrationCredentialId): Promise<IntegrationCredential | null>;
  findActiveByTool(tenantId: string, toolName: ToolName): Promise<IntegrationCredential | null>;
  listActiveByTenant(tenantId: string): Promise<IntegrationCredential[]>;
}

export interface OAuthConnectorRepository {
  save(connector: OAuthConnector): Promise<void>;
  findById(tenantId: string, connectorId: OAuthConnectorId): Promise<OAuthConnector | null>;
  findByProvider(tenantId: string, provider: string): Promise<OAuthConnector | null>;
  listByTenant(tenantId: string): Promise<OAuthConnector[]>;
}

export interface ToolInvocationRepository {
  save(invocation: ToolInvocation): Promise<void>;
  findById(tenantId: string, invocationId: ToolInvocationId): Promise<ToolInvocation | null>;
  listByTenant(tenantId: string, page: PageRequest): Promise<Page<ToolInvocation>>;
}

export type OAuthConnectorState = {
  readonly tenantId: string;
  readonly connectorId: string;
  readonly actorId: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
};

export interface OAuthConnectorStateStorePort {
  save(state: string, value: OAuthConnectorState, ttlSeconds: number): Promise<void>;
  take(state: string): Promise<OAuthConnectorState | null>;
}

export type OAuthTokenSet = {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresInSeconds?: number;
  readonly externalAccountId?: string;
};

export interface OAuthTokenExchangePort {
  exchangeAuthorizationCode(input: {
    readonly tokenUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<OAuthTokenSet>;
  refreshAccessToken(input: {
    readonly tokenUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly refreshToken: string;
  }): Promise<OAuthTokenSet>;
}

export type HttpToolInvokeRequest = {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Record<string, unknown>;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly backoffMs: number;
};

export type HttpToolInvokeResult = {
  readonly status: number;
  readonly data: Record<string, unknown>;
  readonly attemptCount: number;
};

export interface HttpToolInvokerPort {
  invoke(request: HttpToolInvokeRequest): Promise<HttpToolInvokeResult>;
}

export type PlatformToolRequest = {
  readonly tenantId: string;
  readonly toolName: ToolName;
  readonly arguments: Record<string, unknown>;
  readonly actorId: string;
};

export interface PlatformToolHandlerPort {
  execute(request: PlatformToolRequest): Promise<Record<string, unknown>>;
}

export type RateLimitResult = {
  readonly remaining: number;
  readonly limit: number;
  readonly resetSeconds: number;
};

export interface RateLimiterPort {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

export interface OrganizationApiKeyRepository {
  save(apiKey: OrganizationApiKey): Promise<void>;
  findById(tenantId: string, apiKeyId: OrganizationApiKeyId): Promise<OrganizationApiKey | null>;
  findByTokenHash(tokenHash: string): Promise<OrganizationApiKey | null>;
  listByTenant(tenantId: string): Promise<OrganizationApiKey[]>;
  countActiveByTenant(tenantId: string): Promise<number>;
}

export interface WebhookSubscriptionRepository {
  save(subscription: WebhookSubscription): Promise<void>;
  findById(tenantId: string, subscriptionId: WebhookSubscriptionId): Promise<WebhookSubscription | null>;
  listByTenant(tenantId: string): Promise<WebhookSubscription[]>;
  listActiveByTenantAndEvent(tenantId: string, eventName: string): Promise<WebhookSubscription[]>;
  countActiveByTenant(tenantId: string): Promise<number>;
}

export interface WebhookDeliveryRepository {
  save(delivery: WebhookDelivery): Promise<void>;
  findById(tenantId: string, deliveryId: WebhookDeliveryId): Promise<WebhookDelivery | null>;
  listBySubscription(
    tenantId: string,
    subscriptionId: WebhookSubscriptionId,
    page: PageRequest,
  ): Promise<Page<WebhookDelivery>>;
  listDue(now: Date, limit: number, tenantId?: string): Promise<WebhookDelivery[]>;
}

export interface WebhookDeliveryAttemptRepository {
  save(attempt: WebhookDeliveryAttempt): Promise<void>;
  findById(tenantId: string, attemptId: WebhookDeliveryAttemptId): Promise<WebhookDeliveryAttempt | null>;
  listByDelivery(tenantId: string, deliveryId: WebhookDeliveryId): Promise<WebhookDeliveryAttempt[]>;
}

export type ApiUsageListFilter = {
  readonly method?: string;
  readonly route?: string;
  readonly statusCode?: number;
  readonly authKind?: string;
  readonly credentialId?: string;
  readonly from?: Date;
  readonly to?: Date;
};

export type ApiUsageRouteSummary = {
  readonly method: string;
  readonly route: string;
  readonly count: number;
  readonly errorCount: number;
  readonly averageDurationMs: number;
};

export type ApiUsageStatusSummary = {
  readonly statusClass: string;
  readonly count: number;
};

export type ApiUsageAuthSummary = {
  readonly authKind: string;
  readonly count: number;
};

export type ApiUsageDaySummary = {
  readonly date: string;
  readonly count: number;
  readonly errorCount: number;
};

export type ApiUsageSummary = {
  readonly totalRequests: number;
  readonly errorCount: number;
  readonly averageDurationMs: number;
  readonly byRoute: readonly ApiUsageRouteSummary[];
  readonly byStatus: readonly ApiUsageStatusSummary[];
  readonly byAuthKind: readonly ApiUsageAuthSummary[];
  readonly byDay: readonly ApiUsageDaySummary[];
};

export interface ApiUsageRepository {
  save(record: PublicApiUsageRecord): Promise<void>;
  findById(tenantId: string, usageId: PublicApiUsageId): Promise<PublicApiUsageRecord | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter: ApiUsageListFilter,
  ): Promise<Page<PublicApiUsageRecord>>;
  summarize(tenantId: string, from: Date, to: Date): Promise<ApiUsageSummary>;
}

export interface OAuthApplicationRepository {
  save(application: OrganizationOAuthApplication): Promise<void>;
  findById(tenantId: string, applicationId: OAuthApplicationId): Promise<OrganizationOAuthApplication | null>;
  findByClientId(clientId: string): Promise<OrganizationOAuthApplication | null>;
  listByTenant(tenantId: string): Promise<OrganizationOAuthApplication[]>;
  countActiveByTenant(tenantId: string): Promise<number>;
}

export interface OAuthGrantRepository {
  save(grant: OrganizationOAuthGrant): Promise<void>;
  findById(tenantId: string, grantId: OAuthGrantId): Promise<OrganizationOAuthGrant | null>;
  findByCodeHash(codeHash: string): Promise<OrganizationOAuthGrant | null>;
  findByAccessTokenHash(tokenHash: string): Promise<OrganizationOAuthGrant | null>;
  findByRefreshTokenHash(tokenHash: string): Promise<OrganizationOAuthGrant | null>;
}

export type WebhookDispatchRequest = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly timeoutMs: number;
};

export type ConnectorHealthProbeRequest = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
};

export type ConnectorHealthProbeResult = {
  readonly ok: boolean;
  readonly status: number | null;
  readonly latencyMs: number;
  readonly message: string;
};

export interface ConnectorHealthProbePort {
  probe(request: ConnectorHealthProbeRequest): Promise<ConnectorHealthProbeResult>;
}

export type WebhookDispatchResult = {
  readonly status: number;
  readonly durationMs: number;
  readonly bodyPreview?: string;
};

export interface WebhookDispatcherPort {
  dispatch(request: WebhookDispatchRequest): Promise<WebhookDispatchResult>;
}

export interface WebhookSignerPort {
  sign(secret: string, timestampSeconds: number, body: string): string;
  header(timestampSeconds: number, signature: string): string;
  parseHeader(header: string): { timestampSeconds: number; signatures: readonly string[] } | undefined;
  verify(secret: string, timestampSeconds: number, body: string, signature: string): boolean;
}
