import type { AppConfig } from '@ai-customer-support/config';
import type { Logger } from '@ai-customer-support/shared';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../../apps/api/src/bootstrap/server.ts';
import type { AppDependencies } from '../../../apps/api/src/bootstrap/dependencies.ts';
import type { AIServicePort } from '../../../apps/api/src/modules/ai/application/ports/ai-service-port.ts';
import { createAuthenticatePreHandler } from '../../../apps/api/src/modules/identity/adapters/inbound/http/authenticate.ts';
import type {
  AccessTokenClaims,
  IssuedAccessToken,
  TokenIssuerPort,
} from '../../../apps/api/src/modules/identity/application/ports/token-issuer-port.ts';
import { registerIntegrationRoutes } from '../../../apps/api/src/modules/integrations/adapters/inbound/http/integration-routes.ts';
import { AesGcmSecretCipher } from '../../../apps/api/src/modules/integrations/adapters/outbound/crypto.ts';
import { InProcessPlatformToolHandler } from '../../../apps/api/src/modules/integrations/adapters/outbound/in-process-platform-tool-handler.ts';
import {
  ApplyToolResultsUseCase,
  ProposeToolCallsUseCase,
} from '../../../apps/api/src/modules/integrations/application/use-cases/ai-tool-bridge-use-cases.ts';
import {
  ListIntegrationCredentialsUseCase,
  RevokeIntegrationCredentialUseCase,
  UpsertIntegrationCredentialUseCase,
} from '../../../apps/api/src/modules/integrations/application/use-cases/credential-use-cases.ts';
import { ExecuteToolCallUseCase } from '../../../apps/api/src/modules/integrations/application/use-cases/execute-tool-call-use-case.ts';
import { ListToolInvocationsUseCase } from '../../../apps/api/src/modules/integrations/application/use-cases/list-tool-invocations-use-case.ts';
import { ListToolsUseCase } from '../../../apps/api/src/modules/integrations/application/use-cases/list-tools-use-case.ts';
import {
  CompleteOAuthConnectorUseCase,
  DisconnectOAuthConnectorUseCase,
  ListOAuthConnectorsUseCase,
  StartOAuthConnectorUseCase,
  UpsertOAuthConnectorUseCase,
} from '../../../apps/api/src/modules/integrations/application/use-cases/oauth-connector-use-cases.ts';
import { OrganizationsTenantAccessAdapter } from '../../../apps/api/src/modules/integrations/adapters/outbound/organizations-tenant-access-adapter.ts';
import { registerOrganizationRoutes, type OrganizationHttpUseCases } from '../../../apps/api/src/modules/organizations/adapters/inbound/http/organization-routes.ts';
import { LoadTenantMembershipService } from '../../../apps/api/src/modules/organizations/application/load-tenant-membership-service.ts';
import { CreateOrganizationUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/create-organization-use-case.ts';
import { ListMyOrganizationsUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/list-my-organizations-use-case.ts';
import { ResolveTenantAccessUseCase } from '../../../apps/api/src/modules/organizations/application/use-cases/resolve-tenant-access-use-case.ts';
import type { DatabasePort } from '../../../apps/api/src/shared/application/ports/database-port.ts';
import type { QueuePort } from '../../../apps/api/src/shared/application/ports/queue-port.ts';
import type { RedisPort } from '../../../apps/api/src/shared/application/ports/redis-port.ts';
import { InfrastructureHealthChecker } from '../../../apps/api/src/shared/infrastructure/health/infrastructure-health-checker.ts';
import { PinoLogger } from '../../../apps/api/src/shared/infrastructure/logging/pino-logger.ts';
import {
  FakeHttpInvoker,
  FakeOAuthExchange,
  MemoryConnectors,
  MemoryCredentials,
  MemoryInvocations,
} from '../integrations/fakes.ts';
import {
  FixedClock,
  InMemoryMembershipRepository,
  InMemoryOrganizationRepository,
  InMemoryRateLimiter,
  RecordingEventBus,
  RecordingOrganizationAuditLog,
} from '../organizations/fakes.ts';

class FakeDatabase implements DatabasePort {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return true;
  }
}

class FakeRedis implements RedisPort {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return true;
  }
}

class FakeQueue implements QueuePort {
  async enqueue(): Promise<void> {}
  process(): void {}
  async close(): Promise<void> {}
}

class FakeAIService implements AIServicePort {
  async isReady(): Promise<boolean> {
    return true;
  }
  async generateBusinessProfile(): Promise<never> {
    throw new Error('not implemented');
  }
  async generateSupportTonePresets(): Promise<never> {
    throw new Error('not implemented');
  }
  async generateInitialAgentSettings(): Promise<never> {
    throw new Error('not implemented');
  }
  async runOnboardingSetup(): Promise<never> {
    throw new Error('not implemented');
  }
  async *streamSupportReply(): AsyncIterable<never> {
    throw new Error('not implemented');
  }
  async ingestKnowledgeDocument(): Promise<never> {
    throw new Error('not implemented');
  }
  async deleteIndexedKnowledgeDocument(): Promise<never> {
    throw new Error('not implemented');
  }
  async detectIntent(): Promise<never> {
    throw new Error('not implemented');
  }
  async orchestrateSupportTurn(): Promise<never> {
    throw new Error('not implemented');
  }
  async proposeToolCalls() {
    return {
      schemaVersion: 1 as const,
      calls: [{ name: 'getOrderDetails' as const, arguments: { orderId: 'ORD-1' } }],
      reason: null,
    };
  }
  async applyToolResults() {
    return {
      schemaVersion: 1 as const,
      reply: 'Your order is on the way.',
      model: 'heuristic',
      promptTokens: 1,
      completionTokens: 1,
    };
  }
}

class MapTokenIssuer implements TokenIssuerPort {
  constructor(private readonly users: Map<string, string>) {}
  async issueAccessToken(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    return { token: `access:${claims.userId}`, expiresAt: new Date(Date.now() + 900_000) };
  }
  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    if (!token.startsWith('access:')) {
      return null;
    }
    const userId = token.slice('access:'.length);
    const email = this.users.get(userId);
    if (!email) {
      return null;
    }
    return { userId, email };
  }
}

function testConfig(): AppConfig {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3001,
    LOG_LEVEL: 'fatal',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_customer_support',
    REDIS_URL: 'redis://localhost:6380',
    JWT_SECRET: 'a'.repeat(32),
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 604800,
    EMAIL_VERIFICATION_TTL_SECONDS: 86_400,
    PASSWORD_RESET_TTL_SECONDS: 3600,
    INVITATION_TTL_SECONDS: 604800,
    WIDGET_SESSION_TTL_SECONDS: 2592000,
    ATTACHMENT_STORAGE_DIR: './data/attachments',
    KNOWLEDGE_STORAGE_DIR: './data/knowledge',
    WEB_ORIGIN: 'http://localhost:5173',
    AI_SERVICE_URL: 'http://localhost:8000',
    EMAIL_FROM: 'noreply@localhost',
  };
}

describe('integration HTTP routes', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function start() {
    const rootLogger = pino({ level: 'silent' });
    const logger: Logger = new PinoLogger(rootLogger);
    const eventBus = new RecordingEventBus();
    const organizations = new InMemoryOrganizationRepository();
    const memberships = new InMemoryMembershipRepository();
    const auditLog = new RecordingOrganizationAuditLog();
    const clock = new FixedClock(new Date('2026-08-15T12:00:00.000Z'));
    const tenantMemberships = new LoadTenantMembershipService(organizations, memberships);
    const resolveTenantAccess = new ResolveTenantAccessUseCase(tenantMemberships);
    const tokenIssuer = new MapTokenIssuer(new Map([['owner-1', 'owner@example.com']]));
    const authenticate = createAuthenticatePreHandler(tokenIssuer);
    const tenantAccess = new OrganizationsTenantAccessAdapter(resolveTenantAccess);
    const credentials = new MemoryCredentials();
    const connectors = new MemoryConnectors();
    const invocations = new MemoryInvocations();
    const cipher = new AesGcmSecretCipher('a'.repeat(32));
    const aiService = new FakeAIService();

    const orgUseCases = {
      createOrganization: new CreateOrganizationUseCase(
        organizations,
        memberships,
        auditLog,
        new InMemoryRateLimiter(),
        clock,
        eventBus,
      ),
      listMyOrganizations: new ListMyOrganizationsUseCase(organizations, memberships),
      resolveTenantAccess,
    } as unknown as OrganizationHttpUseCases;

    const deps: AppDependencies = {
      config: testConfig(),
      logger,
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      eventBus,
      queue: new FakeQueue(),
      aiService,
      healthChecker: new InfrastructureHealthChecker(new FakeDatabase(), new FakeRedis()),
      organizations: {
        register: async (app) => {
          await registerOrganizationRoutes(app, orgUseCases, authenticate);
        },
      },
      integrations: {
        executeToolCall: new ExecuteToolCallUseCase(
          tenantAccess,
          invocations,
          credentials,
          connectors,
          cipher,
          new FakeHttpInvoker({ status: 200, data: { ok: true }, attemptCount: 1 }),
          new FakeOAuthExchange(),
          new InProcessPlatformToolHandler(),
          clock,
          eventBus,
        ),
        register: async (app) => {
          await registerIntegrationRoutes(
            app,
            {
              listTools: new ListToolsUseCase(tenantAccess),
              executeToolCall: new ExecuteToolCallUseCase(
                tenantAccess,
                invocations,
                credentials,
                connectors,
                cipher,
                new FakeHttpInvoker({ status: 200, data: { ok: true }, attemptCount: 1 }),
                new FakeOAuthExchange(),
                new InProcessPlatformToolHandler(),
                clock,
                eventBus,
              ),
              listInvocations: new ListToolInvocationsUseCase(tenantAccess, invocations),
              proposeToolCalls: new ProposeToolCallsUseCase(tenantAccess, aiService),
              applyToolResults: new ApplyToolResultsUseCase(tenantAccess, aiService),
              upsertCredential: new UpsertIntegrationCredentialUseCase(
                tenantAccess,
                credentials,
                cipher,
                clock,
                eventBus,
              ),
              listCredentials: new ListIntegrationCredentialsUseCase(tenantAccess, credentials),
              revokeCredential: new RevokeIntegrationCredentialUseCase(
                tenantAccess,
                credentials,
                clock,
                eventBus,
              ),
              upsertOAuthConnector: new UpsertOAuthConnectorUseCase(
                tenantAccess,
                connectors,
                cipher,
                clock,
              ),
              listOAuthConnectors: new ListOAuthConnectorsUseCase(tenantAccess, connectors),
              startOAuthConnector: new StartOAuthConnectorUseCase(
                tenantAccess,
                connectors,
                { save: async () => {}, take: async () => null },
                { generate: () => 'state-token' },
                { pkceS256Challenge: () => 'challenge' },
                'https://api.example.com/api/integrations/oauth/callback',
              ),
              completeOAuthConnector: new CompleteOAuthConnectorUseCase(
                connectors,
                { save: async () => {}, take: async () => null },
                new FakeOAuthExchange(),
                cipher,
                clock,
                eventBus,
              ),
              disconnectOAuthConnector: new DisconnectOAuthConnectorUseCase(
                tenantAccess,
                connectors,
                clock,
                eventBus,
              ),
            },
            authenticate,
            resolveTenantAccess,
          );
        },
      },
    };

    const app = await buildServer(deps, rootLogger);
    apps.push(app);
    return app;
  }

  it('lists allowlisted tools, executes a validated call, and audits it', async () => {
    const app = await start();
    const auth = { authorization: 'Bearer access:owner-1' };
    const created = await app.inject({
      method: 'POST',
      url: '/api/organizations',
      headers: auth,
      payload: { name: 'Acme Support' },
    });
    expect(created.statusCode).toBe(201);
    const organizationId = created.json().organization.id as string;
    const tenantHeaders = { ...auth, 'x-tenant-id': organizationId };

    const tools = await app.inject({
      method: 'GET',
      url: `/api/organizations/${organizationId}/tools`,
      headers: tenantHeaders,
    });
    expect(tools.statusCode).toBe(200);
    expect(tools.json().items.map((item: { name: string }) => item.name)).toContain('handoffToAgent');

    const executed = await app.inject({
      method: 'POST',
      url: `/api/organizations/${organizationId}/tools/calls`,
      headers: tenantHeaders,
      payload: {
        name: 'handoffToAgent',
        arguments: {
          conversationId: '22222222-2222-2222-2222-222222222222',
          reason: 'Customer asked for a human',
        },
      },
    });
    expect(executed.statusCode).toBe(200);
    expect(executed.json().invocation.status).toBe('succeeded');

    const rejected = await app.inject({
      method: 'POST',
      url: `/api/organizations/${organizationId}/tools/calls`,
      headers: tenantHeaders,
      payload: { name: 'getOrderDetails', arguments: { orderId: 'ORD-1', extra: true } },
    });
    expect(rejected.statusCode).toBe(400);

    const audit = await app.inject({
      method: 'GET',
      url: `/api/organizations/${organizationId}/tools/invocations`,
      headers: tenantHeaders,
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().total).toBeGreaterThanOrEqual(1);

    const proposed = await app.inject({
      method: 'POST',
      url: `/api/organizations/${organizationId}/tools/propose`,
      headers: tenantHeaders,
      payload: {
        conversationId: '22222222-2222-2222-2222-222222222222',
        visitorMessage: 'Where is my order?',
      },
    });
    expect(proposed.statusCode).toBe(200);
    expect(proposed.json().calls[0].name).toBe('getOrderDetails');
  });
});
