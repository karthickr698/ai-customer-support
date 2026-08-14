import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { IdentifyWidgetVisitorUseCase } from '../conversations/application/use-cases/identify-widget-visitor-use-case.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import { createAuthenticateWidgetSessionPreHandler } from './adapters/inbound/http/authenticate-widget-session.js';
import { registerWidgetRoutes, type AuthenticatePreHandler } from './adapters/inbound/http/widget-routes.js';
import {
  RandomSecureTokenGenerator,
  RedisRateLimiter,
  Sha256TokenHasher,
  SystemClock,
} from './adapters/outbound/crypto/widget-crypto.js';
import { IdentifyWidgetConversationsAdapter } from './adapters/outbound/conversations/identify-widget-conversations-adapter.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { PostgresWidgetConfigurationRepository } from './adapters/outbound/persistence/postgres-widget-configuration-repository.js';
import { PostgresWidgetSessionRepository } from './adapters/outbound/persistence/postgres-widget-session-repository.js';
import { WidgetSessionContextAdapter } from './adapters/outbound/sessions/widget-session-context-adapter.js';
import { GetPublicWidgetConfigurationUseCase, RequireEnabledWidgetService } from './application/use-cases/get-public-widget-configuration-use-case.js';
import {
  GetWidgetConfigurationUseCase,
  RotateWidgetPublicKeyUseCase,
  UpdateWidgetConfigurationUseCase,
} from './application/use-cases/manage-widget-configuration-use-cases.js';
import {
  CreateWidgetSessionUseCase,
  GetWidgetSessionUseCase,
  IdentifyWidgetSessionUseCase,
} from './application/use-cases/widget-session-use-cases.js';

export type WidgetModule = {
  readonly authenticateSession: ReturnType<typeof createAuthenticateWidgetSessionPreHandler>;
  readonly sessionContext: WidgetSessionContextAdapter;
  register(app: FastifyInstance): Promise<void>;
};

export function composeWidget(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly identifyWidgetVisitor: IdentifyWidgetVisitorUseCase;
  readonly sessionTtlSeconds: number;
}): WidgetModule {
  const widgets = new PostgresWidgetConfigurationRepository(input.prisma);
  const sessions = new PostgresWidgetSessionRepository(input.prisma);
  const clock = new SystemClock();
  const hasher = new Sha256TokenHasher();
  const tokens = new RandomSecureTokenGenerator();
  const rateLimiter = new RedisRateLimiter(input.redis);
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const requireWidget = new RequireEnabledWidgetService(widgets);
  const identifyConversations = new IdentifyWidgetConversationsAdapter(input.identifyWidgetVisitor);
  const sessionContext = new WidgetSessionContextAdapter(sessions, widgets, hasher, clock);
  const authenticateSession = createAuthenticateWidgetSessionPreHandler({
    sessions,
    widgets,
    hasher,
    clock,
  });

  const useCases = {
    getWidgetConfiguration: new GetWidgetConfigurationUseCase(tenantAccess, widgets, clock),
    updateWidgetConfiguration: new UpdateWidgetConfigurationUseCase(
      tenantAccess,
      widgets,
      clock,
      input.eventBus,
    ),
    rotateWidgetPublicKey: new RotateWidgetPublicKeyUseCase(
      tenantAccess,
      widgets,
      clock,
      input.eventBus,
    ),
    getPublicWidgetConfiguration: new GetPublicWidgetConfigurationUseCase(widgets),
    createWidgetSession: new CreateWidgetSessionUseCase(
      requireWidget,
      sessions,
      tokens,
      hasher,
      rateLimiter,
      clock,
      input.eventBus,
      input.sessionTtlSeconds,
    ),
    identifyWidgetSession: new IdentifyWidgetSessionUseCase(
      sessions,
      hasher,
      identifyConversations,
      clock,
      input.eventBus,
    ),
    getWidgetSession: new GetWidgetSessionUseCase(sessions, hasher, clock),
  };

  return {
    authenticateSession,
    sessionContext,
    async register(app: FastifyInstance): Promise<void> {
      await registerWidgetRoutes(app, useCases, input.authenticate, input.resolveTenantAccess, {
        sessions,
        widgets,
        hasher,
        clock,
      });
    },
  };
}
