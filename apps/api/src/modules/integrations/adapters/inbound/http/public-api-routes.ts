import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createRequirePermissionPreHandler,
  Permissions,
} from '../../../../organizations/index.js';
import type { RequestSecurityContext } from '../../../application/dtos.js';
import type {
  CreateOrganizationApiKeyUseCase,
  ListOrganizationApiKeysUseCase,
  RevokeOrganizationApiKeyUseCase,
} from '../../../application/use-cases/api-key-use-cases.js';
import type {
  CreateOAuthApplicationUseCase,
  ListConnectorCatalogUseCase,
  ListConnectorConnectionsUseCase,
  ListOAuthApplicationsUseCase,
  RevokeOAuthApplicationUseCase,
} from '../../../application/use-cases/oauth-application-use-cases.js';
import type {
  ApproveOAuthAuthorizationUseCase,
  DescribeOAuthAuthorizationUseCase,
  ExchangeOAuthTokenUseCase,
} from '../../../application/use-cases/oauth-grant-use-cases.js';
import type {
  GetPublicApiSessionUseCase,
  GetPublicApiVersionUseCase,
} from '../../../application/use-cases/public-api-session-use-cases.js';
import type {
  CreateWebhookSubscriptionUseCase,
  DeleteWebhookSubscriptionUseCase,
  GetWebhookSubscriptionUseCase,
  ListWebhookDeliveriesUseCase,
  ListWebhookSubscriptionsUseCase,
  RetryWebhookDeliveryUseCase,
  RotateWebhookSecretUseCase,
  UpdateWebhookSubscriptionUseCase,
} from '../../../application/use-cases/webhook-use-cases.js';
import { DASHBOARD_API_PREFIX, PUBLIC_API_PREFIX } from '../../../domain/api-version.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { parseBody } from './parse-body.js';
import type { AuthenticatePreHandler } from './integration-routes.js';
import { buildPublicApiOpenApiDocument } from './openapi-document.js';
import {
  approveOAuthBodySchema,
  createApiKeyBodySchema,
  createOAuthApplicationBodySchema,
  createWebhookBodySchema,
  deliveryQuerySchema,
  exchangeOAuthTokenBodySchema,
  oauthAuthorizeQuerySchema,
  updateWebhookBodySchema,
} from './public-api-schemas.js';

export type PublicApiHttpUseCases = {
  readonly getVersion: GetPublicApiVersionUseCase;
  readonly getSession: GetPublicApiSessionUseCase;
  readonly createApiKey: CreateOrganizationApiKeyUseCase;
  readonly listApiKeys: ListOrganizationApiKeysUseCase;
  readonly revokeApiKey: RevokeOrganizationApiKeyUseCase;
  readonly createWebhook: CreateWebhookSubscriptionUseCase;
  readonly listWebhooks: ListWebhookSubscriptionsUseCase;
  readonly getWebhook: GetWebhookSubscriptionUseCase;
  readonly updateWebhook: UpdateWebhookSubscriptionUseCase;
  readonly rotateWebhookSecret: RotateWebhookSecretUseCase;
  readonly deleteWebhook: DeleteWebhookSubscriptionUseCase;
  readonly listWebhookDeliveries: ListWebhookDeliveriesUseCase;
  readonly retryWebhookDelivery: RetryWebhookDeliveryUseCase;
  readonly listConnectorCatalog: ListConnectorCatalogUseCase;
  readonly listConnectorConnections: ListConnectorConnectionsUseCase;
  readonly createOAuthApplication: CreateOAuthApplicationUseCase;
  readonly listOAuthApplications: ListOAuthApplicationsUseCase;
  readonly revokeOAuthApplication: RevokeOAuthApplicationUseCase;
  readonly describeOAuthAuthorization: DescribeOAuthAuthorizationUseCase;
  readonly approveOAuthAuthorization: ApproveOAuthAuthorizationUseCase;
  readonly exchangeOAuthToken: ExchangeOAuthTokenUseCase;
};

export async function registerPublicApiRoutes(
  app: FastifyInstance,
  useCases: PublicApiHttpUseCases,
  authenticatePublicApi: AuthenticatePreHandler,
  authenticateSession: AuthenticatePreHandler,
): Promise<void> {
  const requireManage = createRequirePermissionPreHandler(Permissions.INTEGRATION_MANAGE);
  const tenantAuth = [authenticatePublicApi, requireManage];
  const prefixes = [DASHBOARD_API_PREFIX, PUBLIC_API_PREFIX];

  app.get(PUBLIC_API_PREFIX, async (_request, reply) => {
    return reply.status(200).send(useCases.getVersion.execute());
  });

  app.get(`${PUBLIC_API_PREFIX}/openapi.json`, async (_request, reply) => {
    return reply.status(200).send(buildPublicApiOpenApiDocument());
  });

  app.get(`${PUBLIC_API_PREFIX}/docs`, async (_request, reply) => {
    return reply.type('text/html').status(200).send(docsHtml());
  });

  app.get(
    `${PUBLIC_API_PREFIX}/organizations/:organizationId`,
    { preHandler: authenticatePublicApi },
    async (request, reply) => {
      const result = await useCases.getSession.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        authKind: request.apiCredential?.kind ?? 'session',
        scopes: request.apiCredential?.scopes ?? request.tenantAccess?.permissions,
      });
      return reply.status(200).send(result);
    },
  );

  for (const prefix of prefixes) {
    const org = `${prefix}/organizations/:organizationId`;

    app.post(`${org}/api-keys`, { preHandler: tenantAuth }, async (request, reply) => {
      const body = parseBody(createApiKeyBodySchema, request.body);
      const result = await useCases.createApiKey.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        name: body.name,
        scopes: body.scopes,
        expiresAt: body.expiresAt,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    });

    app.get(`${org}/api-keys`, { preHandler: tenantAuth }, async (request, reply) => {
      const result = await useCases.listApiKeys.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    });

    app.delete(`${org}/api-keys/:apiKeyId`, { preHandler: tenantAuth }, async (request, reply) => {
      await useCases.revokeApiKey.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        apiKeyId: routeParam(request, 'apiKeyId'),
        security: securityContext(request),
      });
      return reply.status(204).send();
    });

    app.post(`${org}/webhooks`, { preHandler: tenantAuth }, async (request, reply) => {
      const body = parseBody(createWebhookBodySchema, request.body);
      const result = await useCases.createWebhook.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        url: body.url,
        events: body.events,
        description: body.description,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    });

    app.get(`${org}/webhooks`, { preHandler: tenantAuth }, async (request, reply) => {
      const result = await useCases.listWebhooks.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    });

    app.get(`${org}/webhooks/:webhookId`, { preHandler: tenantAuth }, async (request, reply) => {
      const result = await useCases.getWebhook.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        webhookId: routeParam(request, 'webhookId'),
      });
      return reply.status(200).send(result);
    });

    app.patch(`${org}/webhooks/:webhookId`, { preHandler: tenantAuth }, async (request, reply) => {
      const body = parseBody(updateWebhookBodySchema, request.body);
      const result = await useCases.updateWebhook.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        webhookId: routeParam(request, 'webhookId'),
        url: body.url,
        events: body.events,
        description: body.description,
        status: body.status,
        security: securityContext(request),
      });
      return reply.status(200).send(result);
    });

    app.post(
      `${org}/webhooks/:webhookId/rotate-secret`,
      { preHandler: tenantAuth },
      async (request, reply) => {
        const result = await useCases.rotateWebhookSecret.execute({
          tenantId: requireTenantId(request),
          actorId: requireUserId(request),
          webhookId: routeParam(request, 'webhookId'),
        });
        return reply.status(200).send(result);
      },
    );

    app.delete(`${org}/webhooks/:webhookId`, { preHandler: tenantAuth }, async (request, reply) => {
      await useCases.deleteWebhook.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        webhookId: routeParam(request, 'webhookId'),
      });
      return reply.status(204).send();
    });

    app.get(
      `${org}/webhooks/:webhookId/deliveries`,
      { preHandler: tenantAuth },
      async (request, reply) => {
        const query = parseBody(deliveryQuerySchema, request.query);
        const result = await useCases.listWebhookDeliveries.execute({
          tenantId: requireTenantId(request),
          actorId: requireUserId(request),
          webhookId: routeParam(request, 'webhookId'),
          page: { page: query.page, pageSize: query.pageSize },
        });
        return reply.status(200).send(result);
      },
    );

    app.post(
      `${org}/webhooks/:webhookId/deliveries/:deliveryId/retry`,
      { preHandler: tenantAuth },
      async (request, reply) => {
        const result = await useCases.retryWebhookDelivery.execute({
          tenantId: requireTenantId(request),
          actorId: requireUserId(request),
          webhookId: routeParam(request, 'webhookId'),
          deliveryId: routeParam(request, 'deliveryId'),
        });
        return reply.status(200).send(result);
      },
    );

    app.get(`${org}/connectors/catalog`, { preHandler: tenantAuth }, async (request, reply) => {
      const result = await useCases.listConnectorCatalog.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    });

    app.get(`${org}/connectors`, { preHandler: tenantAuth }, async (request, reply) => {
      const result = await useCases.listConnectorConnections.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    });

    app.post(`${org}/oauth/applications`, { preHandler: tenantAuth }, async (request, reply) => {
      const body = parseBody(createOAuthApplicationBodySchema, request.body);
      const result = await useCases.createOAuthApplication.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
        name: body.name,
        redirectUris: body.redirectUris,
        scopes: body.scopes,
        security: securityContext(request),
      });
      return reply.status(201).send(result);
    });

    app.get(`${org}/oauth/applications`, { preHandler: tenantAuth }, async (request, reply) => {
      const result = await useCases.listOAuthApplications.execute({
        tenantId: requireTenantId(request),
        actorId: requireUserId(request),
      });
      return reply.status(200).send(result);
    });

    app.delete(
      `${org}/oauth/applications/:applicationId`,
      { preHandler: tenantAuth },
      async (request, reply) => {
        await useCases.revokeOAuthApplication.execute({
          tenantId: requireTenantId(request),
          actorId: requireUserId(request),
          applicationId: routeParam(request, 'applicationId'),
          security: securityContext(request),
        });
        return reply.status(204).send();
      },
    );
  }

  app.get(`${PUBLIC_API_PREFIX}/oauth/authorize`, { preHandler: authenticateSession }, async (request, reply) => {
    const query = parseBody(oauthAuthorizeQuerySchema, camelizeQuery(request.query));
    const result = await useCases.describeOAuthAuthorization.execute({
      actorId: requireUserId(request),
      clientId: query.clientId,
      redirectUri: query.redirectUri,
      state: query.state,
      codeChallenge: query.codeChallenge,
      scope: query.scope,
    });
    return reply.status(200).send(result);
  });

  app.post(`${PUBLIC_API_PREFIX}/oauth/authorize`, { preHandler: authenticateSession }, async (request, reply) => {
    const body = parseBody(approveOAuthBodySchema, request.body);
    const result = await useCases.approveOAuthAuthorization.execute({
      actorId: requireUserId(request),
      clientId: body.clientId,
      redirectUri: body.redirectUri,
      state: body.state,
      codeChallenge: body.codeChallenge,
      scope: body.scope,
      approve: body.approve,
    });
    return reply.status(200).send(result);
  });

  app.post(`${PUBLIC_API_PREFIX}/oauth/token`, async (request, reply) => {
    const body = parseBody(exchangeOAuthTokenBodySchema, request.body);
    const result = await useCases.exchangeOAuthToken.execute({
      grantType: body.grantType,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      code: body.code,
      codeVerifier: body.codeVerifier,
      redirectUri: body.redirectUri,
      refreshToken: body.refreshToken,
      ipAddress: request.ip,
    });
    return reply.status(200).send(result);
  });
}

function docsHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AI Customer Support API v1</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>`;
}

function camelizeQuery(query: unknown): Record<string, unknown> {
  const source = query && typeof query === 'object' ? (query as Record<string, unknown>) : {};
  return {
    clientId: source.clientId ?? source.client_id,
    redirectUri: source.redirectUri ?? source.redirect_uri,
    state: source.state,
    codeChallenge: source.codeChallenge ?? source.code_challenge,
    scope: source.scope,
    responseType: source.responseType ?? source.response_type,
  };
}

function requireUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError();
  }
  return request.auth.userId;
}

function requireTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantAccess?.tenantId ?? request.requestContext.tenantId;
  if (!tenantId) {
    throw new UnauthorizedError('Select an organization to continue');
  }
  return tenantId;
}

function routeParam(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

function securityContext(request: FastifyRequest): RequestSecurityContext {
  const userAgentHeader = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    requestId: request.requestContext.requestId,
    correlationId: request.requestContext.correlationId,
  };
}
