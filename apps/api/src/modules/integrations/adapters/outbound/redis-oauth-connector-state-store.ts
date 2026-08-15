import type { Redis } from 'ioredis';
import type { OAuthConnectorState, OAuthConnectorStateStorePort } from '../../application/ports.js';

export class RedisOAuthConnectorStateStore implements OAuthConnectorStateStorePort {
  constructor(private readonly redis: Redis) {}

  async save(state: string, value: OAuthConnectorState, ttlSeconds: number): Promise<void> {
    await this.redis.set(`integration:oauth:state:${state}`, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async take(state: string): Promise<OAuthConnectorState | null> {
    const key = `integration:oauth:state:${state}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }
    await this.redis.del(key);
    try {
      const parsed: unknown = JSON.parse(raw);
      return isState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function isState(value: unknown): value is OAuthConnectorState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.tenantId === 'string' &&
    typeof record.connectorId === 'string' &&
    typeof record.actorId === 'string' &&
    typeof record.codeVerifier === 'string' &&
    typeof record.redirectUri === 'string'
  );
}
