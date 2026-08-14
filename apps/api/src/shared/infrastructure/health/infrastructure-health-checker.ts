import type { DatabasePort } from '../../application/ports/database-port.js';
import type { RedisPort } from '../../application/ports/redis-port.js';

export interface LivenessStatus {
  readonly status: 'ok';
}

export interface ReadinessStatus {
  readonly status: 'ok' | 'unavailable';
  readonly checks: {
    readonly database: 'up' | 'down';
    readonly redis: 'up' | 'down';
  };
}

export class InfrastructureHealthChecker {
  constructor(
    private readonly database: DatabasePort,
    private readonly redis: RedisPort,
  ) {}

  live(): LivenessStatus {
    return { status: 'ok' };
  }

  async ready(): Promise<ReadinessStatus> {
    const [databaseUp, redisUp] = await Promise.all([this.database.isReady(), this.redis.isReady()]);
    const database = databaseUp ? 'up' : 'down';
    const redis = redisUp ? 'up' : 'down';
    const status = databaseUp && redisUp ? 'ok' : 'unavailable';

    return { status, checks: { database, redis } };
  }
}
