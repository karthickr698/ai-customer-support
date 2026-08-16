import type { RealtimeEphemeralFanout } from '../../../application/ports/realtime-publisher-port.js';
import type { Redis } from 'ioredis';

export const EPHEMERAL_CHANNEL = 'realtime:ephemeral';

export class RedisRealtimeEphemeralFanout {
  constructor(private readonly redis: Redis) {}

  async publish(message: RealtimeEphemeralFanout): Promise<void> {
    await this.redis.publish(EPHEMERAL_CHANNEL, JSON.stringify(message));
  }
}
