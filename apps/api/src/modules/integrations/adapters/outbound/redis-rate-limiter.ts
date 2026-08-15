import { RateLimitExceededError } from '@ai-customer-support/shared';
import type { Redis } from 'ioredis';
import type { RateLimiterPort, RateLimitResult } from '../../application/ports.js';

export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const count = await this.redis.incr(key);
    const ttl = await this.redis.ttl(key);

    if (ttl < 0) {
      await this.redis.expire(key, windowSeconds);
    }

    const resetSeconds = ttl > 0 ? ttl : windowSeconds;
    if (count > limit) {
      throw new RateLimitExceededError('Too many requests. Try again later.', resetSeconds);
    }

    return {
      remaining: Math.max(0, limit - count),
      limit,
      resetSeconds,
    };
  }
}
