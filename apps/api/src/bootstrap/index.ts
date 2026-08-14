import { loadConfig } from '@ai-customer-support/config';
import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from './dependencies.js';
import { initializeApplication } from './initialize-application.js';
import { initializeInfrastructure } from './initialize-infrastructure.js';
import { loadLocalEnv } from './load-env.js';
import { buildServer } from './server.js';
import { shutdown } from './shutdown.js';
import { createRootLogger, PinoLogger } from '../shared/infrastructure/logging/pino-logger.js';

loadLocalEnv();

async function main(): Promise<void> {
  const config = loadConfig();
  const rootLogger = createRootLogger(config);
  const logger = new PinoLogger(rootLogger);

  const deps = await initializeInfrastructure(config, logger);
  initializeApplication(deps);

  const app = await buildServer(deps, rootLogger);
  registerProcessHandlers(app, deps);

  await app.listen({ host: config.HOST, port: config.PORT });
  logger.info('API listening', { host: config.HOST, port: config.PORT, env: config.NODE_ENV });
}

function registerProcessHandlers(app: FastifyInstance, deps: AppDependencies): void {
  let shuttingDown = false;

  const onSignal = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    void shutdown(signal, app, deps).then(
      () => process.exit(0),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown shutdown error';
        deps.logger.error('Error during shutdown', { message });
        process.exit(1);
      },
    );
  };

  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('uncaughtException', (error: Error) => {
    deps.logger.error('Uncaught exception', { message: error.message });
    onSignal('uncaughtException');
  });
  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : 'Unhandled promise rejection';
    deps.logger.error('Unhandled rejection', { message });
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to start API';
  console.error(message);
  process.exit(1);
});
