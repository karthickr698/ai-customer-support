import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from './dependencies.js';

export async function shutdown(
  signal: string,
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  deps.logger.info('Shutting down', { signal });

  await app.close();
  await deps.queue.close();
  await deps.redis.disconnect();
  await deps.database.disconnect();

  deps.logger.info('Shutdown complete');
}
