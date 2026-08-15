import type { AppConfig } from '@ai-customer-support/config';
import { integrationCredentialsKey } from '@ai-customer-support/config';
import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { AIServicePort } from '../ai/application/ports/ai-service-port.js';
import type { BusinessDataLookupPort } from '../customers/index.js';
import type { TicketToolPort } from '../tickets/index.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import { createAuthenticatePublicApiPreHandler } from './adapters/inbound/http/authenticate-public-api.js';
import {
  registerIntegrationRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/integration-routes.js';
import { registerPublicApiRoutes } from './adapters/inbound/http/public-api-routes.js';
import { SystemClock } from './adapters/outbound/clock.js';
import {
  AesGcmSecretCipher,
  RandomSecureTokenGenerator,
  Sha256TokenHasher,
} from './adapters/outbound/crypto.js';
import { FetchHttpToolInvoker } from './adapters/outbound/http-tool-invoker.js';
import { FetchWebhookDispatcher } from './adapters/outbound/fetch-webhook-dispatcher.js';
import { HmacWebhookSigner } from './adapters/outbound/hmac-webhook-signer.js';
import { InProcessPlatformToolHandler } from './adapters/outbound/in-process-platform-tool-handler.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations-tenant-access-adapter.js';
import { FetchOAuthTokenExchangeAdapter } from './adapters/outbound/oauth-token-exchange-adapter.js';
import {
  PostgresOAuthApplicationRepository,
  PostgresOAuthGrantRepository,
  PostgresOrganizationApiKeyRepository,
  PostgresWebhookDeliveryRepository,
  PostgresWebhookSubscriptionRepository,
} from './adapters/outbound/postgres-developer-platform-repositories.js';
import {
  PostgresIntegrationCredentialRepository,
  PostgresOAuthConnectorRepository,
  PostgresToolInvocationRepository,
} from './adapters/outbound/postgres-repositories.js';
import { RedisOAuthConnectorStateStore } from './adapters/outbound/redis-oauth-connector-state-store.js';
import { RedisRateLimiter } from './adapters/outbound/redis-rate-limiter.js';
import {
  ApplyToolResultsUseCase,
  ProposeToolCallsUseCase,
} from './application/use-cases/ai-tool-bridge-use-cases.js';
import {
  CreateOrganizationApiKeyUseCase,
  ListOrganizationApiKeysUseCase,
  RevokeOrganizationApiKeyUseCase,
} from './application/use-cases/api-key-use-cases.js';
import { AuthenticateApiCredentialUseCase } from './application/use-cases/authenticate-api-credential-use-case.js';
import {
  ListIntegrationCredentialsUseCase,
  RevokeIntegrationCredentialUseCase,
  UpsertIntegrationCredentialUseCase,
} from './application/use-cases/credential-use-cases.js';
import { DispatchWebhooksUseCase } from './application/use-cases/dispatch-webhooks-use-case.js';
import { ExecuteToolCallUseCase } from './application/use-cases/execute-tool-call-use-case.js';
import { ListToolInvocationsUseCase } from './application/use-cases/list-tool-invocations-use-case.js';
import { ListToolsUseCase } from './application/use-cases/list-tools-use-case.js';
import {
  CreateOAuthApplicationUseCase,
  ListConnectorCatalogUseCase,
  ListConnectorConnectionsUseCase,
  ListOAuthApplicationsUseCase,
  RevokeOAuthApplicationUseCase,
} from './application/use-cases/oauth-application-use-cases.js';
import {
  CompleteOAuthConnectorUseCase,
  DisconnectOAuthConnectorUseCase,
  ListOAuthConnectorsUseCase,
  StartOAuthConnectorUseCase,
  UpsertOAuthConnectorUseCase,
} from './application/use-cases/oauth-connector-use-cases.js';
import {
  ApproveOAuthAuthorizationUseCase,
  DescribeOAuthAuthorizationUseCase,
  ExchangeOAuthTokenUseCase,
} from './application/use-cases/oauth-grant-use-cases.js';
import {
  GetPublicApiSessionUseCase,
  GetPublicApiVersionUseCase,
} from './application/use-cases/public-api-session-use-cases.js';
import {
  CreateWebhookSubscriptionUseCase,
  DeleteWebhookSubscriptionUseCase,
  GetWebhookSubscriptionUseCase,
  ListWebhookDeliveriesUseCase,
  ListWebhookSubscriptionsUseCase,
  RetryWebhookDeliveryUseCase,
  RotateWebhookSecretUseCase,
  UpdateWebhookSubscriptionUseCase,
} from './application/use-cases/webhook-use-cases.js';
import { WEBHOOK_SOURCE_DOMAIN_EVENTS } from './domain/webhook-events.js';

export type IntegrationsModule = {
  readonly executeToolCall: ExecuteToolCallUseCase;
  register(app: FastifyInstance): Promise<void>;
};

export function composeIntegrations(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly config: AppConfig;
  readonly eventBus: EventBus;
  readonly aiService: AIServicePort;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly businessDataLookup?: BusinessDataLookupPort;
  readonly ticketTools?: TicketToolPort;
}): IntegrationsModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const cipher = new AesGcmSecretCipher(integrationCredentialsKey(input.config));
  const credentials = new PostgresIntegrationCredentialRepository(input.prisma);
  const connectors = new PostgresOAuthConnectorRepository(input.prisma);
  const invocations = new PostgresToolInvocationRepository(input.prisma);
  const apiKeys = new PostgresOrganizationApiKeyRepository(input.prisma);
  const webhooks = new PostgresWebhookSubscriptionRepository(input.prisma);
  const deliveries = new PostgresWebhookDeliveryRepository(input.prisma);
  const oauthApps = new PostgresOAuthApplicationRepository(input.prisma);
  const oauthGrants = new PostgresOAuthGrantRepository(input.prisma);
  const oauthState = new RedisOAuthConnectorStateStore(input.redis);
  const oauthExchange = new FetchOAuthTokenExchangeAdapter();
  const tokens = new RandomSecureTokenGenerator();
  const hasher = new Sha256TokenHasher();
  const rateLimiter = new RedisRateLimiter(input.redis);
  const allowLocalHttp = input.config.NODE_ENV !== 'production';

  const listTools = new ListToolsUseCase(tenantAccess);
  const executeToolCall = new ExecuteToolCallUseCase(
    tenantAccess,
    invocations,
    credentials,
    connectors,
    cipher,
    new FetchHttpToolInvoker(),
    oauthExchange,
    new InProcessPlatformToolHandler(input.businessDataLookup, input.ticketTools),
    clock,
    input.eventBus,
  );
  const listInvocations = new ListToolInvocationsUseCase(tenantAccess, invocations);
  const proposeToolCalls = new ProposeToolCallsUseCase(tenantAccess, input.aiService);
  const applyToolResults = new ApplyToolResultsUseCase(tenantAccess, input.aiService);
  const upsertCredential = new UpsertIntegrationCredentialUseCase(
    tenantAccess,
    credentials,
    cipher,
    clock,
    input.eventBus,
  );
  const listCredentials = new ListIntegrationCredentialsUseCase(tenantAccess, credentials);
  const revokeCredential = new RevokeIntegrationCredentialUseCase(
    tenantAccess,
    credentials,
    clock,
    input.eventBus,
  );
  const upsertOAuthConnector = new UpsertOAuthConnectorUseCase(
    tenantAccess,
    connectors,
    cipher,
    clock,
  );
  const listOAuthConnectors = new ListOAuthConnectorsUseCase(tenantAccess, connectors);
  const startOAuthConnector = new StartOAuthConnectorUseCase(
    tenantAccess,
    connectors,
    oauthState,
    tokens,
    hasher,
    input.config.INTEGRATION_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/integrations/oauth/callback',
  );
  const completeOAuthConnector = new CompleteOAuthConnectorUseCase(
    connectors,
    oauthState,
    oauthExchange,
    cipher,
    clock,
    input.eventBus,
  );
  const disconnectOAuthConnector = new DisconnectOAuthConnectorUseCase(
    tenantAccess,
    connectors,
    clock,
    input.eventBus,
  );

  const dispatchWebhooks = new DispatchWebhooksUseCase(
    webhooks,
    deliveries,
    new FetchWebhookDispatcher(),
    new HmacWebhookSigner(),
    cipher,
    clock,
    input.eventBus,
    input.config.WEBHOOK_DELIVERY_TIMEOUT_MS,
  );
  for (const eventName of WEBHOOK_SOURCE_DOMAIN_EVENTS) {
    input.eventBus.subscribe(eventName, (event) => dispatchWebhooks.handleDomainEvent(event));
  }

  const authenticateCredential = new AuthenticateApiCredentialUseCase(apiKeys, oauthGrants, hasher, clock);
  const authenticatePublicApi = createAuthenticatePublicApiPreHandler({
    authenticateSession: input.authenticate,
    authenticateCredential,
    resolveTenantAccess: input.resolveTenantAccess,
    rateLimiter,
    credentialLimit: input.config.PUBLIC_API_RATE_LIMIT_PER_MINUTE,
  });

  const createApiKey = new CreateOrganizationApiKeyUseCase(
    tenantAccess,
    apiKeys,
    tokens,
    hasher,
    rateLimiter,
    clock,
    input.eventBus,
  );
  const listApiKeys = new ListOrganizationApiKeysUseCase(tenantAccess, apiKeys);
  const revokeApiKey = new RevokeOrganizationApiKeyUseCase(tenantAccess, apiKeys, clock, input.eventBus);
  const createWebhook = new CreateWebhookSubscriptionUseCase(
    tenantAccess,
    webhooks,
    cipher,
    tokens,
    rateLimiter,
    clock,
    input.eventBus,
    allowLocalHttp,
  );
  const listWebhooks = new ListWebhookSubscriptionsUseCase(tenantAccess, webhooks);
  const getWebhook = new GetWebhookSubscriptionUseCase(tenantAccess, webhooks);
  const updateWebhook = new UpdateWebhookSubscriptionUseCase(
    tenantAccess,
    webhooks,
    clock,
    input.eventBus,
    allowLocalHttp,
  );
  const rotateWebhookSecret = new RotateWebhookSecretUseCase(tenantAccess, webhooks, cipher, tokens, clock);
  const deleteWebhook = new DeleteWebhookSubscriptionUseCase(tenantAccess, webhooks, clock);
  const listWebhookDeliveries = new ListWebhookDeliveriesUseCase(tenantAccess, webhooks, deliveries);
  const retryWebhookDelivery = new RetryWebhookDeliveryUseCase(
    tenantAccess,
    webhooks,
    deliveries,
    dispatchWebhooks,
  );
  const listConnectorCatalog = new ListConnectorCatalogUseCase(tenantAccess);
  const listConnectorConnections = new ListConnectorConnectionsUseCase(tenantAccess, credentials, connectors);
  const createOAuthApplication = new CreateOAuthApplicationUseCase(
    tenantAccess,
    oauthApps,
    tokens,
    hasher,
    rateLimiter,
    clock,
    input.eventBus,
    allowLocalHttp,
  );
  const listOAuthApplications = new ListOAuthApplicationsUseCase(tenantAccess, oauthApps);
  const revokeOAuthApplication = new RevokeOAuthApplicationUseCase(
    tenantAccess,
    oauthApps,
    clock,
    input.eventBus,
  );
  const describeOAuthAuthorization = new DescribeOAuthAuthorizationUseCase(
    tenantAccess,
    oauthApps,
    rateLimiter,
  );
  const approveOAuthAuthorization = new ApproveOAuthAuthorizationUseCase(
    tenantAccess,
    oauthApps,
    oauthGrants,
    tokens,
    hasher,
    clock,
  );
  const exchangeOAuthToken = new ExchangeOAuthTokenUseCase(
    oauthApps,
    oauthGrants,
    tokens,
    hasher,
    hasher,
    rateLimiter,
    clock,
    input.config.API_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  );

  return {
    executeToolCall,
    async register(app: FastifyInstance): Promise<void> {
      await registerIntegrationRoutes(
        app,
        {
          listTools,
          executeToolCall,
          listInvocations,
          proposeToolCalls,
          applyToolResults,
          upsertCredential,
          listCredentials,
          revokeCredential,
          upsertOAuthConnector,
          listOAuthConnectors,
          startOAuthConnector,
          completeOAuthConnector,
          disconnectOAuthConnector,
        },
        input.authenticate,
        input.resolveTenantAccess,
        { prefixes: ['/api', '/api/v1'] },
      );
      await registerPublicApiRoutes(
        app,
        {
          getVersion: new GetPublicApiVersionUseCase(),
          getSession: new GetPublicApiSessionUseCase(tenantAccess),
          createApiKey,
          listApiKeys,
          revokeApiKey,
          createWebhook,
          listWebhooks,
          getWebhook,
          updateWebhook,
          rotateWebhookSecret,
          deleteWebhook,
          listWebhookDeliveries,
          retryWebhookDelivery,
          listConnectorCatalog,
          listConnectorConnections,
          createOAuthApplication,
          listOAuthApplications,
          revokeOAuthApplication,
          describeOAuthAuthorization,
          approveOAuthAuthorization,
          exchangeOAuthToken,
        },
        authenticatePublicApi,
        input.authenticate,
      );
    },
  };
}
