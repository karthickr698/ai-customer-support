import type { ConnectorDefinitionDto } from '@ai-customer-support/contracts';
import type { IntegrationCredential } from './integration-credential.js';
import type { OAuthConnector } from './oauth-connector.js';
import type { ConnectorConnectionDto } from '@ai-customer-support/contracts';

export const CONNECTOR_CATALOG: readonly ConnectorDefinitionDto[] = [
  {
    provider: 'shopify',
    kind: 'oauth',
    authKind: 'oauth',
    name: 'Shopify',
    description: 'Connect a Shopify store with OAuth to look up orders and customers.',
    defaultAuthorizationUrl: 'https://accounts.shopify.com/oauth/authorize',
    defaultTokenUrl: 'https://accounts.shopify.com/oauth/token',
  },
  {
    provider: 'stripe',
    kind: 'oauth',
    authKind: 'oauth',
    name: 'Stripe',
    description: 'Connect Stripe with OAuth to check refunds and billing status.',
    defaultAuthorizationUrl: 'https://connect.stripe.com/oauth/authorize',
    defaultTokenUrl: 'https://connect.stripe.com/oauth/token',
  },
  {
    provider: 'zendesk',
    kind: 'oauth',
    authKind: 'oauth',
    name: 'Zendesk',
    description: 'Connect Zendesk with OAuth to sync tickets and requester details.',
    defaultAuthorizationUrl: 'https://example.zendesk.com/oauth/authorizations/new',
    defaultTokenUrl: 'https://example.zendesk.com/oauth/tokens',
  },
  {
    provider: 'custom',
    kind: 'oauth',
    authKind: 'oauth',
    name: 'Custom OAuth',
    description: 'Bring your own OAuth 2.1 authorization-code connector with PKCE.',
    defaultAuthorizationUrl: null,
    defaultTokenUrl: null,
  },
  {
    provider: 'custom',
    kind: 'http',
    authKind: 'api_key',
    name: 'Custom HTTP',
    description: 'Call a tenant HTTPS API with an encrypted API key or bearer token.',
    defaultAuthorizationUrl: null,
    defaultTokenUrl: null,
  },
];

export function toHttpConnectorConnection(credential: IntegrationCredential): ConnectorConnectionDto {
  const snapshot = credential.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    kind: 'http',
    provider: snapshot.provider ?? 'custom',
    name: snapshot.name,
    status: snapshot.revokedAt ? 'disconnected' : 'connected',
    toolName: snapshot.toolName,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toOAuthConnectorConnection(connector: OAuthConnector): ConnectorConnectionDto {
  const snapshot = connector.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    kind: 'oauth',
    provider: snapshot.provider,
    name: snapshot.name,
    status: snapshot.status,
    toolName: null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
