import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../../apps/api/src/bootstrap/server.ts';
import type { AppDependencies } from '../../../apps/api/src/bootstrap/dependencies.ts';
import type { AIServicePort } from '../../../apps/api/src/modules/ai/application/ports/ai-service-port.ts';
import type { DatabasePort } from '../../../apps/api/src/shared/application/ports/database-port.ts';
import type { QueuePort } from '../../../apps/api/src/shared/application/ports/queue-port.ts';
import type { RedisPort } from '../../../apps/api/src/shared/application/ports/redis-port.ts';
import { InfrastructureHealthChecker } from '../../../apps/api/src/shared/infrastructure/health/infrastructure-health-checker.ts';
import { PinoLogger } from '../../../apps/api/src/shared/infrastructure/logging/pino-logger.ts';

class FakeDatabase implements DatabasePort {
  constructor(private ready: boolean) {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return this.ready;
  }
}

class FakeRedis implements RedisPort {
  constructor(private ready: boolean) {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isReady(): Promise<boolean> {
    return this.ready;
  }
}

class FakeQueue implements QueuePort {
  async enqueue(): Promise<void> {}
  process(): void {}
  async close(): Promise<void> {}
}

class FakeAIService implements AIServicePort {
  async isReady(): Promise<boolean> {
    return true;
  }

  async generateBusinessProfile(): Promise<never> {
    throw new Error('not implemented');
  }

  async generateSupportTonePresets(): Promise<never> {
    throw new Error('not implemented');
  }

  async generateInitialAgentSettings(): Promise<never> {
    throw new Error('not implemented');
  }

  async runOnboardingSetup(): Promise<never> {
    throw new Error('not implemented');
  }

  async *streamSupportReply(): AsyncIterable<never> {
    throw new Error('not implemented');
  }

  async ingestKnowledgeDocument(): Promise<never> {
    throw new Error('not implemented');
  }

  async deleteIndexedKnowledgeDocument(): Promise<never> {
    throw new Error('not implemented');
  }

  async detectIntent(): Promise<never> {
    throw new Error('not implemented');
  }

  async orchestrateSupportTurn(): Promise<never> {
    throw new Error('not implemented');
  }

  async proposeToolCalls(): Promise<never> {
    throw new Error('not implemented');
  }

  async applyToolResults(): Promise<never> {
    throw new Error('not implemented');
  }

  async runRagPlayground(): Promise<never> {
    throw new Error('not implemented');
  }
}

class FakeEventBus implements EventBus {
  async publish(): Promise<void> {}
  subscribe(): void {}
}

function testConfig(): AppConfig {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3001,
    LOG_LEVEL: 'fatal',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_customer_support',
    REDIS_URL: 'redis://localhost:6380',
    JWT_SECRET: 'a'.repeat(32),
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 604800,
    EMAIL_VERIFICATION_TTL_SECONDS: 86_400,
    PASSWORD_RESET_TTL_SECONDS: 3600,
    INVITATION_TTL_SECONDS: 604800,
    WIDGET_SESSION_TTL_SECONDS: 2592000,
    ATTACHMENT_STORAGE_DIR: './data/attachments',
    KNOWLEDGE_STORAGE_DIR: './data/knowledge',
    WEB_ORIGIN: 'http://localhost:5173',
    AI_SERVICE_URL: 'http://localhost:8000',
    EMAIL_FROM: 'noreply@localhost',
  };
}

function createDeps(databaseReady: boolean, redisReady: boolean): {
  deps: AppDependencies;
  logger: ReturnType<typeof pino>;
} {
  const rootLogger = pino({ level: 'silent' });
  const logger: Logger = new PinoLogger(rootLogger);
  const database = new FakeDatabase(databaseReady);
  const redis = new FakeRedis(redisReady);

  return {
    logger: rootLogger,
    deps: {
      config: testConfig(),
      logger,
      database,
      redis,
      eventBus: new FakeEventBus(),
      queue: new FakeQueue(),
      aiService: new FakeAIService(),
      healthChecker: new InfrastructureHealthChecker(database, redis),
    },
  };
}

describe('health routes', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('returns liveness even when infrastructure is down', async () => {
    const { deps, logger } = createDeps(false, false);
    const app = await buildServer(deps, logger);
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns readiness when PostgreSQL and Redis are up', async () => {
    const { deps, logger } = createDeps(true, true);
    const app = await buildServer(deps, logger);
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('returns unavailable readiness when a dependency is down', async () => {
    const { deps, logger } = createDeps(false, true);
    const app = await buildServer(deps, logger);
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'unavailable',
      checks: { database: 'down', redis: 'up' },
    });
  });

  it('echoes request and correlation ids', async () => {
    const { deps, logger } = createDeps(true, true);
    const app = await buildServer(deps, logger);
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': 'req-123',
        'x-correlation-id': 'corr-456',
      },
    });

    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.headers['x-correlation-id']).toBe('corr-456');
  });

  it('does not treat client tenant or actor headers as authenticated context', async () => {
    const { deps, logger } = createDeps(true, true);
    const app = await buildServer(deps, logger);
    apps.push(app);

    app.get('/__test__/context', async (request) => request.requestContext);

    const response = await app.inject({
      method: 'GET',
      url: '/__test__/context',
      headers: {
        'x-tenant-id': 'spoofed-tenant',
        'x-actor-id': 'spoofed-actor',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      requestId: expect.any(String),
      correlationId: expect.any(String),
    });
    expect(response.json()).not.toHaveProperty('tenantId');
    expect(response.json()).not.toHaveProperty('actorId');
  });
});
