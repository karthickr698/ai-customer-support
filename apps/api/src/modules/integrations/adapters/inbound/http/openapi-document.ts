import {
  PUBLIC_API_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  WEBHOOK_EVENT_NAMES,
} from '@ai-customer-support/contracts';
import { PUBLIC_API_PREFIX } from '../../../domain/api-version.js';

export function buildPublicApiOpenApiDocument(): Record<string, unknown> {
  const org = `${PUBLIC_API_PREFIX}/organizations/{organizationId}`;
  return {
    openapi: '3.1.0',
    info: {
      title: 'AI Customer Support Public API',
      version: PUBLIC_API_VERSION,
      description:
        'Versioned REST API (`/api/v1`) for tenant API keys, HMAC-signed webhooks with delivery logs and retries, API usage tracking, OAuth applications, and a searchable connector marketplace (setup wizard, outbound OAuth, connection health, permissions, and disconnect). Session cookies, `Authorization: Bearer acs_live_…`, or `X-API-Key` authenticate tenant-scoped routes. Responses include `X-API-Version: v1`. Rate limits apply per API key and OAuth access token. Webhook signatures: `X-Webhook-Signature: t=<unix>,v1=<hex>` is HMAC-SHA256 of `{timestamp}.{rawBody}`. Failed deliveries retry with exponential backoff (1m, 5m, 30m, 2h, 8h) up to 5 attempts.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    tags: [
      { name: 'Version' },
      { name: 'API keys' },
      { name: 'Webhooks' },
      { name: 'API usage' },
      { name: 'Connectors' },
      { name: 'OAuth applications' },
      { name: 'OAuth' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'access_token' },
        apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      parameters: {
        organizationId: {
          name: 'organizationId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        tenantHeader: {
          name: 'x-tenant-id',
          in: 'header',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        },
      },
    },
    paths: {
      [PUBLIC_API_PREFIX]: {
        get: {
          tags: ['Version'],
          summary: 'API version',
          security: [],
          responses: { 200: { description: `API ${PUBLIC_API_VERSION} metadata (schema ${PUBLIC_API_SCHEMA_VERSION})` } },
        },
      },
      [`${PUBLIC_API_PREFIX}/openapi.json`]: {
        get: {
          tags: ['Version'],
          summary: 'OpenAPI document',
          security: [],
          responses: { 200: { description: 'OpenAPI 3.1 document' } },
        },
      },
      [`${org}`]: {
        get: {
          tags: ['Version'],
          summary: 'Inspect authenticated public API session',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 200: { description: 'Auth kind and granted scopes' } },
        },
      },
      [`${org}/api-keys`]: {
        get: {
          tags: ['API keys'],
          summary: 'List API keys',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 200: { description: 'API keys without secrets' } },
        },
        post: {
          tags: ['API keys'],
          summary: 'Create API key',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    scopes: { type: 'array', items: { type: 'string' } },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'API key; `token` is shown once' } },
        },
      },
      [`${org}/api-keys/{apiKeyId}`]: {
        delete: {
          tags: ['API keys'],
          summary: 'Revoke API key',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'apiKeyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 204: { description: 'Revoked' } },
        },
      },
      [`${org}/webhooks`]: {
        get: {
          tags: ['Webhooks'],
          summary: 'List webhook subscriptions',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 200: { description: 'Subscriptions without signing secrets' } },
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Create webhook subscription',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'events'],
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    events: { type: 'array', items: { type: 'string', enum: [...WEBHOOK_EVENT_NAMES] } },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description:
                'Subscription created. `secret` is shown once. Verify `X-Webhook-Signature: t=unix,v1=hex` as HMAC-SHA256 of `{t}.{body}`.',
            },
          },
        },
      },
      [`${org}/webhooks/{webhookId}`]: {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook subscription',
          parameters: webhookParams(),
          responses: { 200: { description: 'Subscription' } },
        },
        patch: {
          tags: ['Webhooks'],
          summary: 'Update webhook subscription',
          parameters: webhookParams(),
          responses: { 200: { description: 'Updated subscription' } },
        },
        delete: {
          tags: ['Webhooks'],
          summary: 'Disable webhook subscription',
          parameters: webhookParams(),
          responses: { 204: { description: 'Disabled' } },
        },
      },
      [`${org}/webhooks/{webhookId}/rotate-secret`]: {
        post: {
          tags: ['Webhooks'],
          summary: 'Rotate webhook signing secret',
          parameters: webhookParams(),
          responses: { 200: { description: 'New secret shown once' } },
        },
      },
      [`${org}/webhooks/{webhookId}/deliveries`]: {
        get: {
          tags: ['Webhooks'],
          summary: 'List webhook deliveries',
          parameters: webhookParams(),
          responses: { 200: { description: 'Delivery log (status, attempts, next retry)' } },
        },
      },
      [`${org}/webhooks/{webhookId}/deliveries/{deliveryId}`]: {
        get: {
          tags: ['Webhooks'],
          summary: 'Get a webhook delivery',
          parameters: [
            ...webhookParams(),
            { name: 'deliveryId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Delivery metadata and stored event payload' } },
        },
      },
      [`${org}/webhooks/{webhookId}/deliveries/{deliveryId}/attempts`]: {
        get: {
          tags: ['Webhooks'],
          summary: 'List webhook delivery attempts',
          parameters: [
            ...webhookParams(),
            { name: 'deliveryId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: {
              description:
                'Per-attempt log: HTTP status, duration, `X-Webhook-Signature` header, timestamp, and response preview',
            },
          },
        },
      },
      [`${org}/webhooks/{webhookId}/deliveries/{deliveryId}/retry`]: {
        post: {
          tags: ['Webhooks'],
          summary: 'Retry a webhook delivery',
          parameters: [
            ...webhookParams(),
            { name: 'deliveryId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Re-signed delivery attempt' } },
        },
      },
      [`${org}/webhooks/{webhookId}/verify-signature`]: {
        post: {
          tags: ['Webhooks'],
          summary: 'Verify a webhook signature',
          parameters: webhookParams(),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['signatureHeader', 'body'],
                  properties: {
                    signatureHeader: {
                      type: 'string',
                      description: '`X-Webhook-Signature` value: `t=<unix>,v1=<hex>`',
                    },
                    body: { type: 'string', description: 'Raw JSON body that was signed' },
                    toleranceSeconds: { type: 'integer', default: 300 },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description:
                'Checks timestamp freshness and HMAC-SHA256 of `{t}.{body}` against the subscription secret',
            },
          },
        },
      },
      [`${org}/webhooks/dispatch`]: {
        post: {
          tags: ['Webhooks'],
          summary: 'Dispatch due webhook retries',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 200: { description: 'Number of due failed deliveries retried' } },
        },
      },
      [`${org}/api-usage`]: {
        get: {
          tags: ['API usage'],
          summary: 'API usage summary',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          ],
          responses: {
            200: {
              description: 'Request totals, errors, average latency, and breakdowns by route, status, auth, and day',
            },
          },
        },
      },
      [`${org}/api-usage/requests`]: {
        get: {
          tags: ['API usage'],
          summary: 'List API usage requests',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'method', in: 'query', schema: { type: 'string' } },
            { name: 'route', in: 'query', schema: { type: 'string' } },
            { name: 'statusCode', in: 'query', schema: { type: 'integer' } },
            { name: 'authKind', in: 'query', schema: { type: 'string', enum: ['session', 'api_key', 'oauth_token'] } },
            { name: 'credentialId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          ],
          responses: { 200: { description: 'Paginated `/api/v1` request log for this organization' } },
        },
      },
      [`${org}/connectors/catalog`]: {
        get: {
          tags: ['Connectors'],
          summary: 'Search the connector marketplace catalog',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search name, provider, or category' },
            { name: 'kind', in: 'query', schema: { type: 'string', enum: ['http', 'oauth'] } },
            {
              name: 'category',
              in: 'query',
              schema: { type: 'string', enum: ['commerce', 'payments', 'support', 'custom'] },
            },
          ],
          responses: { 200: { description: 'HTTP and OAuth connector catalog with setup steps and permissions' } },
        },
      },
      [`${org}/connectors/catalog/{catalogId}`]: {
        get: {
          tags: ['Connectors'],
          summary: 'Get a connector catalog item',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'catalogId', in: 'path', required: true, schema: { type: 'string', example: 'oauth-shopify' } },
          ],
          responses: { 200: { description: 'Catalog definition including wizard steps and permissions' } },
        },
      },
      [`${org}/connectors`]: {
        get: {
          tags: ['Connectors'],
          summary: 'List connected connectors',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'kind', in: 'query', schema: { type: 'string', enum: ['http', 'oauth'] } },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['connected', 'pending', 'expired', 'disconnected'] },
            },
          ],
          responses: { 200: { description: 'Unified HTTP credential and OAuth connector connections with health' } },
        },
      },
      [`${org}/connectors/setup`]: {
        post: {
          tags: ['Connectors'],
          summary: 'Start connector setup wizard',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 201: { description: 'Pending or connected marketplace connection' } },
        },
      },
      [`${org}/connectors/{connectionId}`]: {
        get: {
          tags: ['Connectors'],
          summary: 'Get a connector connection',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Connection with health, permissions, and status' } },
        },
        delete: {
          tags: ['Connectors'],
          summary: 'Disconnect a connector',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 204: { description: 'OAuth tokens dropped or HTTP credential revoked' } },
        },
      },
      [`${org}/connectors/{connectionId}/oauth/authorize`]: {
        post: {
          tags: ['Connectors'],
          summary: 'Start connector OAuth authorization',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'PKCE authorization URL' } },
        },
      },
      [`${org}/connectors/{connectionId}/oauth/complete`]: {
        post: {
          tags: ['Connectors'],
          summary: 'Complete connector OAuth authorization',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Connected OAuth connector' } },
        },
      },
      [`${org}/connectors/{connectionId}/health`]: {
        post: {
          tags: ['Connectors'],
          summary: 'Probe connector connection health',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Live health probe result' } },
        },
      },
      [`${org}/connectors/{connectionId}/permissions`]: {
        patch: {
          tags: ['Connectors'],
          summary: 'Update connector permissions',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'Updated granted scopes or HTTP tool permission' } },
        },
      },
      [`${org}/oauth/applications`]: {
        get: {
          tags: ['OAuth applications'],
          summary: 'List OAuth applications',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 200: { description: 'Applications without client secrets' } },
        },
        post: {
          tags: ['OAuth applications'],
          summary: 'Create OAuth application',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 201: { description: 'Application; `clientSecret` is shown once' } },
        },
      },
      [`${org}/oauth/applications/{applicationId}`]: {
        delete: {
          tags: ['OAuth applications'],
          summary: 'Revoke OAuth application',
          parameters: [
            { $ref: '#/components/parameters/organizationId' },
            { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 204: { description: 'Revoked' } },
        },
      },
      [`${PUBLIC_API_PREFIX}/oauth/authorize`]: {
        get: {
          tags: ['OAuth'],
          summary: 'Describe authorization consent',
          security: [{ sessionCookie: [] }],
          parameters: [
            { name: 'client_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'redirect_uri', in: 'query', required: true, schema: { type: 'string', format: 'uri' } },
            { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'code_challenge', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'scope', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'response_type', in: 'query', required: false, schema: { type: 'string', enum: ['code'] } },
          ],
          responses: { 200: { description: 'Application name and requested scopes' } },
        },
        post: {
          tags: ['OAuth'],
          summary: 'Approve authorization and issue a code',
          security: [{ sessionCookie: [] }],
          responses: { 200: { description: 'Redirect URL with code and state' } },
        },
      },
      [`${PUBLIC_API_PREFIX}/oauth/token`]: {
        post: {
          tags: ['OAuth'],
          summary: 'Exchange an authorization code or refresh token',
          security: [],
          responses: { 200: { description: 'Access and refresh tokens' } },
        },
      },
      [`${org}/tools`]: {
        get: {
          tags: ['Connectors'],
          summary: 'List allowlisted tools (v1 alias)',
          parameters: [{ $ref: '#/components/parameters/organizationId' }],
          responses: { 200: { description: 'Tool catalog' } },
        },
      },
    },
  };
}

function webhookParams() {
  return [
    { $ref: '#/components/parameters/organizationId' },
    { name: 'webhookId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
  ];
}
