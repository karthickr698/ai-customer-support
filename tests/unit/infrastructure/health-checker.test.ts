import { InfrastructureHealthChecker } from '../../../apps/api/src/shared/infrastructure/health/infrastructure-health-checker.ts';
import type { DatabasePort } from '../../../apps/api/src/shared/application/ports/database-port.ts';
import type { RedisPort } from '../../../apps/api/src/shared/application/ports/redis-port.ts';
import { describe, expect, it } from 'vitest';

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

describe('InfrastructureHealthChecker', () => {
  it('reports liveness without checking infrastructure', () => {
    const checker = new InfrastructureHealthChecker(new FakeDatabase(false), new FakeRedis(false));

    expect(checker.live()).toEqual({ status: 'ok' });
  });

  it('reports ready when database and redis are up', async () => {
    const checker = new InfrastructureHealthChecker(new FakeDatabase(true), new FakeRedis(true));

    await expect(checker.ready()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('reports unavailable when a dependency is down', async () => {
    const checker = new InfrastructureHealthChecker(new FakeDatabase(true), new FakeRedis(false));

    await expect(checker.ready()).resolves.toEqual({
      status: 'unavailable',
      checks: { database: 'up', redis: 'down' },
    });
  });
});
