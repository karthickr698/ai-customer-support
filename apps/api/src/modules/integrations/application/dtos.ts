import type {
  IntegrationCredentialDto,
  OAuthConnectorDto,
  OrganizationApiKeyDto,
  OrganizationOAuthApplicationDto,
  ToolInvocationDto,
  WebhookDeliveryDto,
  WebhookSubscriptionDto,
} from '@ai-customer-support/contracts';
import type { OrganizationApiKey } from '../domain/api-key.js';
import type { IntegrationCredential } from '../domain/integration-credential.js';
import type { OrganizationOAuthApplication } from '../domain/oauth-application.js';
import type { OAuthConnector } from '../domain/oauth-connector.js';
import type { ToolInvocation } from '../domain/tool-invocation.js';
import type { WebhookDelivery } from '../domain/webhook-delivery.js';
import type { WebhookSubscription } from '../domain/webhook-subscription.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toCredentialDto(credential: IntegrationCredential): IntegrationCredentialDto {
  const snapshot = credential.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    toolName: snapshot.toolName,
    provider: snapshot.provider ?? null,
    name: snapshot.name,
    kind: snapshot.kind,
    headerName: snapshot.headerName,
    baseUrl: snapshot.baseUrl,
    secretLastFour: snapshot.secretLastFour,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toConnectorDto(connector: OAuthConnector): OAuthConnectorDto {
  const snapshot = connector.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    provider: snapshot.provider,
    name: snapshot.name,
    status: snapshot.status,
    authorizationUrl: snapshot.authorizationUrl,
    tokenUrl: snapshot.tokenUrl,
    clientId: snapshot.clientId,
    scopes: snapshot.scopes,
    tokenExpiresAt: snapshot.tokenExpiresAt?.toISOString() ?? null,
    externalAccountId: snapshot.externalAccountId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toInvocationDto(invocation: ToolInvocation): ToolInvocationDto {
  const snapshot = invocation.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    toolName: snapshot.toolName,
    conversationId: snapshot.conversationId ?? null,
    actorId: snapshot.actorId ?? null,
    actorType: snapshot.actorType,
    status: snapshot.status,
    arguments: snapshot.arguments,
    result: snapshot.result ?? null,
    errorCode: snapshot.errorCode ?? null,
    errorMessage: snapshot.errorMessage ?? null,
    attemptCount: snapshot.attemptCount,
    durationMs: snapshot.durationMs,
    createdAt: snapshot.createdAt.toISOString(),
    completedAt: snapshot.completedAt?.toISOString() ?? null,
  };
}

export function toApiKeyDto(apiKey: OrganizationApiKey): OrganizationApiKeyDto {
  const snapshot = apiKey.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    prefix: snapshot.prefix,
    scopes: snapshot.scopes,
    status: apiKey.status,
    lastUsedAt: snapshot.lastUsedAt?.toISOString() ?? null,
    expiresAt: snapshot.expiresAt?.toISOString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toWebhookDto(subscription: WebhookSubscription): WebhookSubscriptionDto {
  const snapshot = subscription.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    url: snapshot.url,
    description: snapshot.description ?? null,
    events: snapshot.events,
    status: snapshot.status,
    secretLastFour: snapshot.secretLastFour,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toWebhookDeliveryDto(delivery: WebhookDelivery): WebhookDeliveryDto {
  const snapshot = delivery.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subscriptionId: snapshot.subscriptionId,
    eventName: snapshot.eventName,
    status: snapshot.status,
    attemptCount: snapshot.attemptCount,
    responseStatus: snapshot.responseStatus ?? null,
    errorMessage: snapshot.errorMessage ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    completedAt: snapshot.completedAt?.toISOString() ?? null,
  };
}

export function toOAuthApplicationDto(
  application: OrganizationOAuthApplication,
): OrganizationOAuthApplicationDto {
  const snapshot = application.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    clientId: snapshot.clientId,
    clientSecretLastFour: snapshot.clientSecretLastFour,
    redirectUris: snapshot.redirectUris,
    scopes: snapshot.scopes,
    status: application.status,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
