import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger as PinoBaseLogger } from 'pino';
import type { AppDependencies } from './dependencies.js';
import { httpErrorHandler } from '../shared/adapters/inbound/http/error-handler.js';
import { registerHealthRoutes } from '../shared/adapters/inbound/http/health-routes.js';
import { registerRequestCorrelation } from '../shared/adapters/inbound/http/request-correlation.js';

export async function buildServer(
  deps: AppDependencies,
  rootLogger: PinoBaseLogger,
): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({
    loggerInstance: rootLogger as FastifyBaseLogger,
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    logController: new LogController({
      requestIdLogLabel: 'requestId',
      disableRequestLogging: deps.config.NODE_ENV === 'test',
    }),
  });

  await app.register(cors, {
    origin: deps.config.WEB_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);

  registerRequestCorrelation(app);
  app.setErrorHandler(httpErrorHandler);
  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
  });

  registerHealthRoutes(app, deps.healthChecker);

  if (deps.identity) {
    await deps.identity.register(app);
  }

  return app;
}
