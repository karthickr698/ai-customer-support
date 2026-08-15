import type { AppConfig } from '@ai-customer-support/config';
import type { Logger } from '@ai-customer-support/shared';
import type { AppDependencies } from './dependencies.js';
import { PythonAIServiceAdapter } from '../modules/ai/adapters/outbound/python-ai/python-ai-service-adapter.js';
import { composeAgents } from '../modules/agents/compose-agents.js';
import { composeConversations } from '../modules/conversations/compose-conversations.js';
import { composeKnowledge } from '../modules/knowledge/compose-knowledge.js';
import { composeOnboarding } from '../modules/onboarding/compose-onboarding.js';
import { composeIdentity } from '../modules/identity/compose-identity.js';
import { composeOrganizations } from '../modules/organizations/compose-organizations.js';
import { composeIntegrations } from '../modules/integrations/compose-integrations.js';
import { composeWidget } from '../modules/widget/compose-widget.js';
import { IdentifyWidgetVisitorUseCase } from '../modules/conversations/application/use-cases/identify-widget-visitor-use-case.js';
import { PostgresConversationRepository } from '../modules/conversations/adapters/outbound/persistence/postgres-conversation-repository.js';
import { SystemClock } from '../modules/conversations/adapters/outbound/clock/system-clock.js';
import { InMemoryEventBus } from '../shared/infrastructure/events/in-memory-event-bus.js';
import { InfrastructureHealthChecker } from '../shared/infrastructure/health/infrastructure-health-checker.js';
import { InMemoryQueue } from '../shared/infrastructure/messaging/in-memory-queue.js';
import { createPrismaClient } from '../shared/infrastructure/persistence/prisma.js';
import { PostgresDatabase } from '../shared/infrastructure/persistence/postgres-database.js';
import { IoRedisAdapter } from '../shared/infrastructure/redis/ioredis-adapter.js';

export async function initializeInfrastructure(
  config: AppConfig,
  logger: Logger,
): Promise<AppDependencies> {
  const database = new PostgresDatabase(createPrismaClient(config.DATABASE_URL));
  const redis = new IoRedisAdapter(config.REDIS_URL);
  const eventBus = new InMemoryEventBus(logger);
  const queue = new InMemoryQueue(logger);

  await database.connect();
  logger.info('PostgreSQL connected');

  await redis.connect();
  logger.info('Redis connected');

  const healthChecker = new InfrastructureHealthChecker(database, redis);
  const aiService = new PythonAIServiceAdapter(config.AI_SERVICE_URL, logger);
  const identity = composeIdentity({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    config,
    logger,
    eventBus,
  });
  const organizations = composeOrganizations({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    config,
    logger,
    eventBus,
    userDirectory: identity.userQuery,
    authenticate: identity.authenticate,
  });

  const agents = composeAgents({
    redis: redis.forAdapter(),
    eventBus,
    logger,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    memberQuery: organizations.memberQuery,
    userDirectory: identity.userQuery,
  });

  const knowledge = composeKnowledge({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    queue,
    aiService,
    logger,
    knowledgeStorageDir: config.KNOWLEDGE_STORAGE_DIR,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
  });

  const onboarding = composeOnboarding({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    aiService,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    knowledgeSourceQuery: knowledge.sourceQuery,
    registerKnowledgeSource: knowledge.registerKnowledgeSource,
  });

  const widget = composeWidget({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    eventBus,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    identifyWidgetVisitor: new IdentifyWidgetVisitorUseCase(
      new PostgresConversationRepository(database.forRepositoryAdapter()),
      new SystemClock(),
    ),
    sessionTtlSeconds: config.WIDGET_SESSION_TTL_SECONDS,
  });

  const integrations = composeIntegrations({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    config,
    eventBus,
    aiService,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
  });

  const conversations = composeConversations({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    eventBus,
    logger,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    memberQuery: organizations.memberQuery,
    userDirectory: identity.userQuery,
    presenceQuery: agents.presenceQuery,
    listPresence: agents.listPresence,
    connectPresence: agents.connectPresence,
    disconnectPresence: agents.disconnectPresence,
    heartbeatPresence: agents.heartbeatPresence,
    setPresence: agents.setPresence,
    aiService,
    agentSettingsQuery: onboarding.agentSettingsQuery,
    widgetSessionContext: widget.sessionContext,
    authenticateWidgetSession: widget.authenticateSession,
    attachmentStorageDir: config.ATTACHMENT_STORAGE_DIR,
  });

  return {
    config,
    logger,
    database,
    redis,
    eventBus,
    queue,
    aiService,
    healthChecker,
    identity,
    organizations,
    agents,
    conversations,
    knowledge,
    onboarding,
    widget,
    integrations,
  };
}
