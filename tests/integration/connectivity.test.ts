import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { PostgresDatabase } from '../../apps/api/src/shared/infrastructure/persistence/postgres-database.ts';
import { IoRedisAdapter } from '../../apps/api/src/shared/infrastructure/redis/ioredis-adapter.ts';
import { InfrastructureHealthChecker } from '../../apps/api/src/shared/infrastructure/health/infrastructure-health-checker.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadDotenv({ path: resolve(root, '.env') });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ai_customer_support';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';

describe('infrastructure connectivity', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const database = new PostgresDatabase(prisma);
  const redis = new IoRedisAdapter(redisUrl);

  afterAll(async () => {
    await redis.disconnect();
    await database.disconnect();
  });

  it('connects to PostgreSQL', async () => {
    await database.connect();
    await expect(database.isReady()).resolves.toBe(true);
  });

  it('connects to Redis', async () => {
    await redis.connect();
    await expect(redis.isReady()).resolves.toBe(true);
  });

  it('reports ready when both dependencies respond', async () => {
    const checker = new InfrastructureHealthChecker(database, redis);
    const readiness = await checker.ready();

    expect(readiness).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });
});
