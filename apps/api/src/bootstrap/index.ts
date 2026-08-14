import { loadConfig } from '@ai-customer-support/config';
import pino from 'pino';
import type { AppDependencies } from './dependencies.js';
import { buildServer } from './server.js';
import { shutdown } from './shutdown.js';
import { InMemoryEventBus } from '../shared/infrastructure/events/in-memory-event-bus.js';
import { PinoLogger } from '../shared/infrastructure/logging/pino-logger.js';
import { InMemoryQueue } from '../shared/infrastructure/messaging/in-memory-queue.js';
import { createPrismaClient } from '../shared/infrastructure/persistence/prisma.js';
import { createRedisClient } from '../shared/infrastructure/redis/redis-client.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const pinoLogger = pino({
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV !== 'production'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
  const logger = new PinoLogger(pinoLogger);

  const deps: AppDependencies = {
    config,
    logger,
    prisma: createPrismaClient(),
    redis: createRedisClient(config.REDIS_URL),
    eventBus: new InMemoryEventBus(),
    queue: new InMemoryQueue(),
  };

  const app = await buildServer(deps);

  const onSignal = (signal: string): void => {
    void shutdown(signal, app, deps);
  };

  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  await deps.prisma.$connect();
  await deps.redis.connect();

  await app.listen({ host: config.HOST, port: config.PORT });
  logger.info('API listening', { host: config.HOST, port: config.PORT });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to start API';
  console.error(message);
  process.exit(1);
});
