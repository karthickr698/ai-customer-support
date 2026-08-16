import type {
  ConnectorCatalogResponse,
  ConnectorCategory,
  ConnectorConnectionDto,
  ConnectorConnectionStatus,
  ConnectorDefinitionDto,
  ConnectorHealthDto,
  ConnectorKind,
} from '@ai-customer-support/contracts';
import type { IntegrationCredential } from './integration-credential.js';
import type { OAuthConnector } from './oauth-connector.js';

const OAUTH_SETUP_STEPS = [
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm the connector, what it can access, and that HTTPS endpoints are required.',
  },
  {
    id: 'permissions',
    title: 'Permissions',
    description: 'Choose the scopes this workspace will request from the provider.',
  },
  {
    id: 'credentials',
    title: 'Credentials',
    description: 'Store the OAuth client id and secret. Secrets are encrypted and never returned.',
  },
  {
    id: 'authorize',
    title: 'Authorize',
    description: 'Complete the PKCE authorization-code flow with the provider.',
  },
  {
    id: 'health',
    title: 'Verify',
    description: 'Check connection health before using the connector in tool calls.',
  },
] as const;

const HTTP_SETUP_STEPS = [
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm the HTTPS API this credential will call for allowlisted tools.',
  },
  {
    id: 'permissions',
    title: 'Permissions',
    description: 'Choose the allowlisted HTTP tool this credential is allowed to execute.',
  },
  {
    id: 'credentials',
    title: 'Credentials',
    description: 'Store an API key or bearer token against a HTTPS base URL.',
  },
  {
    id: 'health',
    title: 'Verify',
    description: 'Probe the base URL with the stored credential.',
  },
] as const;

export const CONNECTOR_CATALOG: readonly ConnectorDefinitionDto[] = [
  {
    id: 'oauth-shopify',
    provider: 'shopify',
    kind: 'oauth',
    authKind: 'oauth',
    category: 'commerce',
    name: 'Shopify',
    description: 'Connect a Shopify store with OAuth to look up orders and customers.',
    websiteUrl: 'https://www.shopify.com',
    defaultAuthorizationUrl: 'https://accounts.shopify.com/oauth/authorize',
    defaultTokenUrl: 'https://accounts.shopify.com/oauth/token',
    defaultScopes: ['read_orders', 'read_customers'],
    permissions: [
      {
        id: 'read_orders',
        label: 'Read orders',
        description: 'Look up order details for visitor questions.',
        required: true,
      },
      {
        id: 'read_customers',
        label: 'Read customers',
        description: 'Match store customers to support conversations.',
        required: false,
      },
      {
        id: 'read_fulfillments',
        label: 'Read fulfillments',
        description: 'Check shipment and fulfillment status.',
        required: false,
      },
    ],
    setupSteps: OAUTH_SETUP_STEPS,
    searchTerms: ['shopify', 'store', 'orders', 'commerce', 'ecommerce'],
  },
  {
    id: 'oauth-stripe',
    provider: 'stripe',
    kind: 'oauth',
    authKind: 'oauth',
    category: 'payments',
    name: 'Stripe',
    description: 'Connect Stripe with OAuth to check refunds and billing status.',
    websiteUrl: 'https://stripe.com',
    defaultAuthorizationUrl: 'https://connect.stripe.com/oauth/authorize',
    defaultTokenUrl: 'https://connect.stripe.com/oauth/token',
    defaultScopes: ['read_refunds'],
    permissions: [
      {
        id: 'read_refunds',
        label: 'Read refunds',
        description: 'Check refund status for an order.',
        required: true,
      },
      {
        id: 'read_customers',
        label: 'Read customers',
        description: 'Look up Stripe customer billing details.',
        required: false,
      },
    ],
    setupSteps: OAUTH_SETUP_STEPS,
    searchTerms: ['stripe', 'payments', 'refunds', 'billing', 'checkout'],
  },
  {
    id: 'oauth-zendesk',
    provider: 'zendesk',
    kind: 'oauth',
    authKind: 'oauth',
    category: 'support',
    name: 'Zendesk',
    description: 'Connect Zendesk with OAuth to sync tickets and requester details.',
    websiteUrl: 'https://www.zendesk.com',
    defaultAuthorizationUrl: 'https://example.zendesk.com/oauth/authorizations/new',
    defaultTokenUrl: 'https://example.zendesk.com/oauth/tokens',
    defaultScopes: ['tickets:read'],
    permissions: [
      {
        id: 'tickets:read',
        label: 'Read tickets',
        description: 'Look up Zendesk tickets related to a conversation.',
        required: true,
      },
      {
        id: 'users:read',
        label: 'Read users',
        description: 'Match Zendesk requesters to workspace customers.',
        required: false,
      },
    ],
    setupSteps: OAUTH_SETUP_STEPS,
    searchTerms: ['zendesk', 'tickets', 'helpdesk', 'support'],
  },
  {
    id: 'oauth-custom',
    provider: 'custom',
    kind: 'oauth',
    authKind: 'oauth',
    category: 'custom',
    name: 'Custom OAuth',
    description: 'Bring your own OAuth 2.1 authorization-code connector with PKCE.',
    websiteUrl: null,
    defaultAuthorizationUrl: null,
    defaultTokenUrl: null,
    defaultScopes: [],
    permissions: [],
    setupSteps: OAUTH_SETUP_STEPS,
    searchTerms: ['oauth', 'custom', 'pkce', 'openid'],
  },
  {
    id: 'http-custom',
    provider: 'custom',
    kind: 'http',
    authKind: 'api_key',
    category: 'custom',
    name: 'Custom HTTP',
    description: 'Call a tenant HTTPS API with an encrypted API key or bearer token.',
    websiteUrl: null,
    defaultAuthorizationUrl: null,
    defaultTokenUrl: null,
    defaultScopes: [],
    permissions: [
      {
        id: 'getOrderDetails',
        label: 'Get order details',
        description: 'Authorize this credential for the order lookup HTTP tool.',
        required: false,
      },
      {
        id: 'checkRefundStatus',
        label: 'Check refund status',
        description: 'Authorize this credential for the refund status HTTP tool.',
        required: false,
      },
    ],
    setupSteps: HTTP_SETUP_STEPS,
    searchTerms: ['http', 'api key', 'bearer', 'custom', 'webhook'],
  },
];

const BY_ID = new Map(CONNECTOR_CATALOG.map((item) => [item.id, item]));

export type ConnectorCatalogFilter = {
  readonly q?: string;
  readonly kind?: ConnectorKind;
  readonly category?: ConnectorCategory;
};

export function connectorCatalogId(kind: ConnectorKind, provider: string): string {
  return `${kind}-${provider.trim().toLowerCase() || 'custom'}`;
}

export function getConnectorCatalogItem(catalogId: string): ConnectorDefinitionDto | undefined {
  return BY_ID.get(catalogId.trim());
}

export function searchConnectorCatalog(filter: ConnectorCatalogFilter = {}): ConnectorCatalogResponse {
  const query = filter.q?.trim().toLowerCase();
  const items = CONNECTOR_CATALOG.filter((item) => {
    if (filter.kind && item.kind !== filter.kind) {
      return false;
    }
    if (filter.category && item.category !== filter.category) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [item.id, item.provider, item.name, item.description, item.category, ...item.searchTerms]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
  return { items };
}

export function requiredCatalogPermissions(definition: ConnectorDefinitionDto): readonly string[] {
  return definition.permissions.filter((item) => item.required).map((item) => item.id);
}

export function catalogPermissionIds(definition: ConnectorDefinitionDto): ReadonlySet<string> {
  return new Set(definition.permissions.map((item) => item.id));
}

export function deriveConnectionHealth(input: {
  readonly status: ConnectorConnectionStatus;
  readonly tokenExpiresAt?: Date;
  readonly now: Date;
}): ConnectorHealthDto {
  if (input.status === 'disconnected') {
    return {
      status: 'disconnected',
      source: 'derived',
      checkedAt: input.now.toISOString(),
      message: 'This connector is disconnected.',
      latencyMs: null,
    };
  }
  if (input.status === 'pending') {
    return {
      status: 'unknown',
      source: 'derived',
      checkedAt: input.now.toISOString(),
      message: 'Authorization is not complete.',
      latencyMs: null,
    };
  }
  if (input.status === 'expired' || (input.tokenExpiresAt && input.tokenExpiresAt.getTime() <= input.now.getTime())) {
    return {
      status: 'degraded',
      source: 'derived',
      checkedAt: input.now.toISOString(),
      message: 'The access token is expired or about to expire. Reconnect or refresh.',
      latencyMs: null,
    };
  }
  return {
    status: 'healthy',
    source: 'derived',
    checkedAt: input.now.toISOString(),
    message: 'The connector is connected.',
    latencyMs: null,
  };
}

export function toHttpConnectorConnection(
  credential: IntegrationCredential,
  now = new Date(),
): ConnectorConnectionDto {
  const snapshot = credential.toSnapshot();
  const provider = snapshot.provider ?? 'custom';
  const status: ConnectorConnectionStatus = snapshot.revokedAt ? 'disconnected' : 'connected';
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    catalogId: connectorCatalogId('http', provider),
    kind: 'http',
    provider,
    name: snapshot.name,
    status,
    toolName: snapshot.toolName,
    permissions: [snapshot.toolName],
    reconnectRequired: false,
    tokenExpiresAt: null,
    externalAccountId: null,
    health: deriveConnectionHealth({ status, now }),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toOAuthConnectorConnection(
  connector: OAuthConnector,
  now = new Date(),
): ConnectorConnectionDto {
  const snapshot = connector.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    catalogId: connectorCatalogId('oauth', snapshot.provider),
    kind: 'oauth',
    provider: snapshot.provider,
    name: snapshot.name,
    status: snapshot.status,
    toolName: null,
    permissions: snapshot.scopes,
    reconnectRequired: snapshot.status === 'pending' || snapshot.status === 'expired',
    tokenExpiresAt: snapshot.tokenExpiresAt?.toISOString() ?? null,
    externalAccountId: snapshot.externalAccountId ?? null,
    health: deriveConnectionHealth({
      status: snapshot.status,
      tokenExpiresAt: snapshot.tokenExpiresAt,
      now,
    }),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function withConnectionHealth(
  connection: ConnectorConnectionDto,
  health: ConnectorHealthDto,
): ConnectorConnectionDto {
  return { ...connection, health };
}
