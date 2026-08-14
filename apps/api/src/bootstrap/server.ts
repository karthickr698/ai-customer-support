import { DomainError } from '@ai-customer-support/shared';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppDependencies } from './dependencies.js';
import { registerHealthRoute } from './health.js';

export async function buildServer(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.LOG_LEVEL,
      ...(deps.config.NODE_ENV !== 'production'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : {}),
    },
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  await app.register(cors, {
    origin: deps.config.WEB_ORIGIN,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(400).send({
        error: { code: error.code, message: error.message },
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  registerHealthRoute(app, deps);

  return app;
}
