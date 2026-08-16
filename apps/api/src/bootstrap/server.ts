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
    bodyLimit: Math.max(deps.config.SECURITY_MAX_REQUEST_BYTES ?? 1_048_576, 10 * 1024 * 1024),
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

  if (deps.security) {
    await deps.security.register(app);
  }

  if (deps.platform) {
    await deps.platform.register(app);
  }

  if (deps.observability) {
    await deps.observability.register(app);
  }

  if (deps.identity) {
    await deps.identity.register(app);
  }

  if (deps.organizations) {
    await deps.organizations.register(app);
  }

  if (deps.customers) {
    await deps.customers.register(app);
  }

  if (deps.tickets) {
    await deps.tickets.register(app);
  }

  if (deps.automations) {
    await deps.automations.register(app);
  }

  if (deps.analytics) {
    await deps.analytics.register(app);
  }

  if (deps.notifications) {
    await deps.notifications.register(app);
  }

  if (deps.billing) {
    await deps.billing.register(app);
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

  if (deps.agentConfiguration) {
    await deps.agentConfiguration.register(app);
  }

  if (deps.integrations) {
    await deps.integrations.register(app);
  }

  return app;
}
