import {
  CONNECTOR_CATEGORIES,
  CONNECTOR_CONNECTION_STATUSES,
  CONNECTOR_KINDS,
  INTEGRATION_CREDENTIAL_KINDS,
  TOOL_NAMES,
  WEBHOOK_EVENT_NAMES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

export const createApiKeyBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const createWebhookBodySchema = z.object({
  url: z.string().trim().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_NAMES)).min(1).max(WEBHOOK_EVENT_NAMES.length),
  description: z.string().trim().min(1).max(200).optional(),
});

export const updateWebhookBodySchema = z.object({
  url: z.string().trim().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_NAMES)).min(1).max(WEBHOOK_EVENT_NAMES.length).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['active', 'paused'] as const).optional(),
});

export const createOAuthApplicationBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  redirectUris: z.array(z.string().trim().url()).min(1).max(10),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const oauthAuthorizeQuerySchema = z.object({
  clientId: z.string().min(1).max(200),
  redirectUri: z.string().url(),
  state: z.string().min(1).max(500),
  codeChallenge: z.string().min(16).max(128),
  scope: z.string().max(500).optional(),
  responseType: z.literal('code').optional(),
});

export const approveOAuthBodySchema = z.object({
  clientId: z.string().min(1).max(200),
  redirectUri: z.string().url(),
  state: z.string().min(1).max(500),
  codeChallenge: z.string().min(16).max(128),
  scope: z.string().max(500).optional(),
  approve: z.boolean().optional(),
});

export const exchangeOAuthTokenBodySchema = z.object({
  grantType: z.enum(['authorization_code', 'refresh_token']),
  clientId: z.string().min(1).max(200),
  clientSecret: z.string().min(8).max(8_000),
  code: z.string().min(1).max(4_000).optional(),
  codeVerifier: z.string().min(16).max(128).optional(),
  redirectUri: z.string().url().optional(),
  refreshToken: z.string().min(1).max(4_000).optional(),
});

export const deliveryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const verifyWebhookSignatureBodySchema = z.object({
  signatureHeader: z.string().trim().min(10).max(500),
  body: z.string().min(1).max(200_000),
  toleranceSeconds: z.number().int().min(0).max(3_600).optional(),
});

export const apiUsageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  method: z.string().trim().min(1).max(10).optional(),
  route: z.string().trim().min(1).max(500).optional(),
  statusCode: z.coerce.number().int().min(100).max(599).optional(),
  authKind: z.enum(['session', 'api_key', 'oauth_token']).optional(),
  credentialId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const apiUsageSummaryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const connectorCatalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  kind: z.enum(CONNECTOR_KINDS).optional(),
  category: z.enum(CONNECTOR_CATEGORIES).optional(),
});

export const connectorConnectionQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  kind: z.enum(CONNECTOR_KINDS).optional(),
  status: z.enum(CONNECTOR_CONNECTION_STATUSES).optional(),
});

export const setupConnectorBodySchema = z.object({
  catalogId: z.string().trim().min(3).max(80),
  name: z.string().trim().min(1).max(120).optional(),
  permissions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  clientId: z.string().trim().min(1).max(200).optional(),
  clientSecret: z.string().min(8).max(8_000).optional(),
  authorizationUrl: z.string().trim().url().optional(),
  tokenUrl: z.string().trim().url().optional(),
  toolName: z.enum(TOOL_NAMES).optional(),
  credentialKind: z.enum(INTEGRATION_CREDENTIAL_KINDS).optional(),
  secret: z.string().min(8).max(8_000).optional(),
  baseUrl: z.string().trim().url().optional(),
  headerName: z.string().trim().min(1).max(80).optional(),
  provider: z.string().trim().min(1).max(40).optional(),
});

export const completeConnectorOAuthBodySchema = z.object({
  code: z.string().min(1).max(4_000),
  state: z.string().min(1).max(500),
});

export const updateConnectorPermissionsBodySchema = z.object({
  permissions: z.array(z.string().trim().min(1).max(80)).max(20),
});
