import { createHash, randomBytes } from 'node:crypto';
import type { ClockPort } from '../../../application/ports/clock-port.js';
import type {
  RateLimiterPort,
  SecureTokenGeneratorPort,
  TokenHasherPort,
} from '../../../application/ports/security-ports.js';
import { RateLimitExceededError } from '@ai-customer-support/shared';
import type { Redis } from 'ioredis';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

export class RandomSecureTokenGenerator implements SecureTokenGeneratorPort {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}

export class Sha256TokenHasher implements TokenHasherPort {
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

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
