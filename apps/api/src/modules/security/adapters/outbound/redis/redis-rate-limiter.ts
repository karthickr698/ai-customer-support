import { RateLimitExceededError } from '@ai-customer-support/shared';
import type { Redis } from 'ioredis';
import type { RateLimiterPort, RateLimitWindow } from '../../../application/ports.js';

export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitWindow> {
    const count = await this.redis.incr(key);
    let ttl = await this.redis.ttl(key);
    if (ttl < 0) {
      await this.redis.expire(key, windowSeconds);
      ttl = windowSeconds;
    }
    if (count > limit) {
      throw new RateLimitExceededError('Too many requests. Try again later.', ttl > 0 ? ttl : windowSeconds);
    }
    return { used: count, ttlSeconds: ttl };
  }

  async peek(key: string): Promise<RateLimitWindow> {
    const [countRaw, ttl] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
    return {
      used: countRaw ? Number.parseInt(countRaw, 10) || 0 : 0,
      ttlSeconds: ttl > 0 ? ttl : 0,
    };
  }
}
