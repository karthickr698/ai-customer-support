import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from './dependencies.js';

export async function shutdown(
  signal: string,
  app: FastifyInstance,
  deps: AppDependencies,
): Promise<void> {
  deps.logger.info('Shutting down', { signal });

  try {
    await app.close();
    await deps.prisma.$disconnect();
    deps.redis.disconnect();
    deps.logger.info('Shutdown complete');
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown shutdown error';
    deps.logger.error('Error during shutdown', { message });
    process.exit(1);
  }
}
