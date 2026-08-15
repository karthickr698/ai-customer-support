import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
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
    origin: (origin, callback) => {
      if (!origin || origin === deps.config.WEB_ORIGIN) {
        callback(null, true);
        return;
      }

      // Widget embeds run on customer origins. Allowed origins are enforced per tenant.
      callback(null, true);
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });
  await app.register(websocket);

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

  if (deps.organizations) {
    await deps.organizations.register(app);
  }

  if (deps.agents) {
    await deps.agents.register(app);
  }

  if (deps.conversations) {
    await deps.conversations.register(app);
  }

  if (deps.knowledge) {
    await deps.knowledge.register(app);
  }

  if (deps.onboarding) {
    await deps.onboarding.register(app);
  }

  if (deps.widget) {
    await deps.widget.register(app);
  }

  if (deps.integrations) {
    await deps.integrations.register(app);
  }

  return app;
}
