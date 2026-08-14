import type { FastifyInstance } from 'fastify';
import type { InfrastructureHealthChecker } from '../../../infrastructure/health/infrastructure-health-checker.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  healthChecker: InfrastructureHealthChecker,
): void {
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send(healthChecker.live());
  });

  app.get('/ready', async (_request, reply) => {
    const readiness = await healthChecker.ready();
    const statusCode = readiness.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(readiness);
  });
}
