import type { AIServicePort } from '../../../../ai/application/ports/ai-service-port.js';
import type { DatabasePort } from '../../../../../shared/application/ports/database-port.js';
import type { RedisPort } from '../../../../../shared/application/ports/redis-port.js';
import type { HealthComponentSnapshot } from '../../../domain/health-report.js';
import type { PlatformHealthProbePort } from '../../../application/ports.js';

export class InfrastructurePlatformHealthProbe implements PlatformHealthProbePort {
  constructor(
    private readonly database: DatabasePort,
    private readonly redis: RedisPort,
    private readonly aiService: AIServicePort,
  ) {}

  async probe(): Promise<readonly HealthComponentSnapshot[]> {
    const [database, redis, aiService] = await Promise.all([
      timed('database', () => this.database.isReady()),
      timed('redis', () => this.redis.isReady()),
      timed('ai_service', () => this.aiService.isReady()),
    ]);
    return [database, redis, aiService];
  }
}

async function timed(
  name: HealthComponentSnapshot['name'],
  check: () => Promise<boolean>,
): Promise<HealthComponentSnapshot> {
  const started = Date.now();
  try {
    const up = await check();
    return { name, status: up ? 'up' : 'down', latencyMs: Date.now() - started };
  } catch {
    return { name, status: 'down', latencyMs: Date.now() - started };
  }
}
