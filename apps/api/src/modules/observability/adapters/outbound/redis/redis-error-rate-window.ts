import type { Redis } from 'ioredis';
import type { ErrorRateWindow, ErrorRateWindowPort } from '../../../application/ports.js';

export class RedisErrorRateWindow implements ErrorRateWindowPort {
  constructor(private readonly redis: Redis) {}

  async increment(input: {
    readonly key: string;
    readonly isError: boolean;
    readonly windowSeconds: number;
  }): Promise<ErrorRateWindow> {
    const totalKey = `observability:window:${input.key}:total`;
    const errorKey = `observability:window:${input.key}:errors`;
    const total = await this.incrWithTtl(totalKey, input.windowSeconds);
    const errors = input.isError ? await this.incrWithTtl(errorKey, input.windowSeconds) : await this.peek(errorKey);
    return { total, errors };
  }

  async incrementFailures(key: string, windowSeconds: number): Promise<number> {
    return this.incrWithTtl(`observability:failures:${key}`, windowSeconds);
  }

  async resetFailures(key: string): Promise<void> {
    await this.redis.del(`observability:failures:${key}`);
  }

  private async incrWithTtl(key: string, windowSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return count;
  }

  private async peek(key: string): Promise<number> {
    const raw = await this.redis.get(key);
    return raw ? Number.parseInt(raw, 10) || 0 : 0;
  }
}
