import { Redis } from 'ioredis';
import type { RedisPort } from '../../application/ports/redis-port.js';

export class IoRedisAdapter implements RedisPort {
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.status === 'end' || this.client.status === 'wait') {
      this.client.disconnect();
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  /**
   * Redis client for outbound adapters constructed in the composition root.
   * Domain and use cases must not import this.
   */
  forAdapter(): Redis {
    return this.client;
  }

  async isReady(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
