import { securityEncryptionKey, type AppConfig } from '@ai-customer-support/config';
import type { Logger } from '@ai-customer-support/shared';
import type { AppDependencies } from './dependencies.js';
import { PythonAIServiceAdapter } from '../modules/ai/adapters/outbound/python-ai/python-ai-service-adapter.js';
import { composeAgents } from '../modules/agents/compose-agents.js';
import { composeConversations } from '../modules/conversations/compose-conversations.js';
import type { ConversationHandoffPort } from '../modules/conversations/index.js';
import { composeKnowledge } from '../modules/knowledge/compose-knowledge.js';
import { composeOnboarding } from '../modules/onboarding/compose-onboarding.js';
import { composeCustomers } from '../modules/customers/compose-customers.js';
import { composeTickets } from '../modules/tickets/compose-tickets.js';
import { composeAutomations } from '../modules/automations/compose-automations.js';
import { composeAnalytics } from '../modules/analytics/compose-analytics.js';
import { composeNotifications } from '../modules/notifications/compose-notifications.js';
import { composeBilling } from '../modules/billing/compose-billing.js';
import { composeSecurity } from '../modules/security/compose-security.js';
import { composePlatform } from '../modules/platform/compose-platform.js';
import { composeObservability } from '../modules/observability/compose-observability.js';
import { composeIdentity } from '../modules/identity/compose-identity.js';
import { composeOrganizations } from '../modules/organizations/compose-organizations.js';
import { composeIntegrations } from '../modules/integrations/compose-integrations.js';
import { composeWidget } from '../modules/widget/compose-widget.js';
import { composeAgentConfiguration } from '../modules/agent-configuration/compose-agent-configuration.js';
import { IdentifyWidgetVisitorUseCase } from '../modules/conversations/application/use-cases/identify-widget-visitor-use-case.js';
import { ConversationTicketSourceQuery } from '../modules/conversations/application/conversation-ticket-source-query.js';
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
  const observabilityPlaceholder: { telemetry?: import('../modules/ai/application/ports/ai-service-port.js').AICallTelemetryPort } =
    {};
  const aiService = new PythonAIServiceAdapter(config.AI_SERVICE_URL, logger, fetch, {
    record: (telemetry) => observabilityPlaceholder.telemetry?.record(telemetry) ?? Promise.resolve(),
  });
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

  const agentConfiguration = composeAgentConfiguration({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
  });

  const customers = composeCustomers({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
  });

  const conversationRepository = new PostgresConversationRepository(database.forRepositoryAdapter());
  const tickets = composeTickets({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    eventBus,
    logger,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    memberQuery: organizations.memberQuery,
    userDirectory: identity.userQuery,
    presenceQuery: agents.presenceQuery,
    conversationSource: new ConversationTicketSourceQuery(conversationRepository),
    attachmentStorageDir: config.ATTACHMENT_STORAGE_DIR,
  });

  const automations = composeAutomations({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    queue,
    logger,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    allowLocalHttp: config.NODE_ENV !== 'production',
  });

  const analytics = composeAnalytics({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
  });

  const notifications = composeNotifications({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    queue,
    logger,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    emailFrom: config.EMAIL_FROM,
    smtpUrl: config.SMTP_URL,
    nodeEnv: config.NODE_ENV,
    allowLocalHttp: config.NODE_ENV !== 'production',
    webhookTimeoutMs: config.WEBHOOK_DELIVERY_TIMEOUT_MS,
  });

  const billing = composeBilling({
    prisma: database.forRepositoryAdapter(),
    eventBus,
    logger,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    billingProvider: config.BILLING_PROVIDER,
    stripeSecretKey: config.STRIPE_SECRET_KEY,
    stripeWebhookSecret: config.STRIPE_WEBHOOK_SECRET,
    stripeApiBaseUrl: config.STRIPE_API_BASE_URL,
    billingWebhookSecret: config.BILLING_WEBHOOK_SECRET,
    successUrl: config.BILLING_SUCCESS_URL ?? `${config.WEB_ORIGIN}/billing/success`,
    cancelUrl: config.BILLING_CANCEL_URL ?? `${config.WEB_ORIGIN}/billing/cancel`,
    allowLocalHttp: config.NODE_ENV !== 'production',
  });

  const security = composeSecurity({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    eventBus,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    encryptionKey: securityEncryptionKey(config),
    encryptionKeyVersion: config.SECURITY_ENCRYPTION_KEY_VERSION,
    production: config.NODE_ENV === 'production',
    globalRateLimitPerMinute: config.SECURITY_GLOBAL_RATE_LIMIT_PER_MINUTE,
    maxRequestBytes: config.SECURITY_MAX_REQUEST_BYTES,
  });

  const platform = composePlatform({
    prisma: database.forRepositoryAdapter(),
    database,
    redis,
    aiService,
    eventBus,
    logger,
    authenticate: identity.authenticate,
    userQuery: identity.userQuery,
    organizationAdmin: organizations.adminQuery,
    bootstrapEmail: config.PLATFORM_BOOTSTRAP_EMAIL,
  });

  const observability = composeObservability({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    eventBus,
    logger,
    config,
    authenticate: identity.authenticate,
    platformActors: platform.actors,
    resolveTenantAccess: organizations.resolveTenantAccess,
  });
  observabilityPlaceholder.telemetry = observability.telemetry;

  const conversationHandoffPlaceholder: { current?: ConversationHandoffPort } = {};
  const conversationHandoff: ConversationHandoffPort = {
    handoffToHuman: (input) => {
      if (!conversationHandoffPlaceholder.current) {
        return Promise.resolve({
          handedOff: false,
          conversationId: input.conversationId,
          assignedAgentId: null,
          status: 'open',
          reason: input.reason,
        });
      }

      return conversationHandoffPlaceholder.current.handoffToHuman(input);
    },
  };

  const integrations = composeIntegrations({
    prisma: database.forRepositoryAdapter(),
    redis: redis.forAdapter(),
    config,
    eventBus,
    logger,
    aiService,
    authenticate: identity.authenticate,
    resolveTenantAccess: organizations.resolveTenantAccess,
    businessDataLookup: customers.lookup,
    ticketTools: tickets.ticketTools,
    conversationHandoff,
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
    agentConfigurationQuery: agentConfiguration.configurationQuery,
    widgetSessionContext: widget.sessionContext,
    authenticateWidgetSession: widget.authenticateSession,
    attachmentStorageDir: config.ATTACHMENT_STORAGE_DIR,
    ticketIntake: tickets.openFromConversation,
  });
  conversationHandoffPlaceholder.current = conversations.handoffToHuman;

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
    customers,
    tickets,
    automations,
    analytics,
    notifications,
    billing,
    security,
    platform,
    observability,
    agents,
    conversations,
    knowledge,
    onboarding,
    widget,
    agentConfiguration,
    integrations,
  };
}
