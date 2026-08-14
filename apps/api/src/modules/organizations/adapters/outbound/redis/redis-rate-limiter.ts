import { RateLimitExceededError } from '@ai-customer-support/shared';
import type { Redis } from 'ioredis';
import type { RateLimiterPort } from '../../../application/ports/rate-limiter-port.js';

export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incr(key);
    const ttl = await this.redis.ttl(key);

    if (ttl < 0) {
      await this.redis.expire(key, windowSeconds);
    }

    if (count > limit) {
      const retryAfter = ttl > 0 ? ttl : windowSeconds;
      throw new RateLimitExceededError('Too many requests. Try again later.', retryAfter);
    }
  }
}
