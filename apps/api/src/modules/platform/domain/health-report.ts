import type { PlatformComponentStatus, PlatformHealthStatus } from '@ai-customer-support/contracts';

export type HealthComponentName = 'database' | 'redis' | 'ai_service';

export type HealthComponentSnapshot = {
  readonly name: HealthComponentName;
  readonly status: PlatformComponentStatus;
  readonly latencyMs: number;
};

export class PlatformHealthReport {
  private constructor(
    readonly status: PlatformHealthStatus,
    readonly checkedAt: Date,
    readonly checks: readonly HealthComponentSnapshot[],
  ) {}

  static from(checks: readonly HealthComponentSnapshot[], now: Date): PlatformHealthReport {
    const database = checks.find((check) => check.name === 'database');
    const upCount = checks.filter((check) => check.status === 'up').length;
    let status: PlatformHealthStatus = 'ok';
    if (database?.status === 'down' || upCount === 0) {
      status = 'unavailable';
    } else if (upCount < checks.length) {
      status = 'degraded';
    }
    return new PlatformHealthReport(status, now, checks);
  }
}
