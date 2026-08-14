import type { AppConfig } from '@ai-customer-support/config';
import type { Logger } from '@ai-customer-support/shared';
import type { AppDependencies } from './dependencies.js';
import { PythonAIServiceAdapter } from '../modules/ai/adapters/outbound/python-ai/python-ai-service-adapter.js';
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

  return {
    config,
    logger,
    database,
    redis,
    eventBus,
    queue,
    aiService,
    healthChecker,
  };
}
