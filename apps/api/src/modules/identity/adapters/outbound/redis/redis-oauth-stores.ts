import type { Redis } from 'ioredis';
import type {
  OAuthLoginCode,
  OAuthLoginCodeStorePort,
  OAuthState,
  OAuthStateStorePort,
} from '../../../application/ports/oauth-state-store-port.js';

export class RedisOAuthStateStore implements OAuthStateStorePort {
  constructor(private readonly redis: Redis) {}

  async save(state: string, value: OAuthState, ttlSeconds: number): Promise<void> {
    await this.redis.set(`oauth:state:${state}`, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async take(state: string): Promise<OAuthState | null> {
    return takeJson(this.redis, `oauth:state:${state}`, isOAuthState);
  }
}

export class RedisOAuthLoginCodeStore implements OAuthLoginCodeStorePort {
  constructor(private readonly redis: Redis) {}

  async save(code: string, value: OAuthLoginCode, ttlSeconds: number): Promise<void> {
    await this.redis.set(`oauth:login:${code}`, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async take(code: string): Promise<OAuthLoginCode | null> {
    return takeJson(this.redis, `oauth:login:${code}`, isOAuthLoginCode);
  }
}

async function takeJson<T>(
  redis: Redis,
  key: string,
  guard: (value: unknown) => value is T,
): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  await redis.del(key);

  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isOAuthState(value: unknown): value is OAuthState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).codeVerifier === 'string'
  );
}

function isOAuthLoginCode(value: unknown): value is OAuthLoginCode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).userId === 'string'
  );
}
