import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from './dependencies.js';

export function registerHealthRoute(app: FastifyInstance, deps: AppDependencies): void {
  app.get('/health', async (_request, reply) => {
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' = 'down';

    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    try {
      const pong = await deps.redis.ping();
      redis = pong === 'PONG' ? 'up' : 'down';
    } catch {
      redis = 'down';
    }

    const status = database === 'up' && redis === 'up' ? 'ok' : 'degraded';
    const code = status === 'ok' ? 200 : 503;

    return reply.status(code).send({ status, database, redis });
  });
}
