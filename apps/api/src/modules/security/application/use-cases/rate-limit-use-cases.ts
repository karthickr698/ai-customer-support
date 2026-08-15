import type { SecurityRateLimitsResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  RATE_LIMIT_WINDOW_SECONDS,
} from '../../domain/security-controls.js';
import { SecurityPolicy } from '../../domain/security-policy.js';
import { toRateLimitWindowDto } from '../dtos.js';
import type { ClockPort, RateLimiterPort, SecurityPolicyRepository, TenantAccessPort } from '../ports.js';
import { ProvisionSecurityPolicyUseCase } from './policy-use-cases.js';

export function ipRateLimitKey(ipAddress: string): string {
  return `security:rl:ip:${ipAddress}`;
}

export function tenantRateLimitKey(tenantId: string): string {
  return `security:rl:tenant:${tenantId}`;
}

export class GetSecurityRateLimitsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly provision: ProvisionSecurityPolicyUseCase,
    private readonly clock: ClockPort,
    private readonly globalLimitPerMinute: number,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ipAddress: string;
  }): Promise<SecurityRateLimitsResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_READ);
    const policy = await this.provision.execute({ tenantId: actor.tenantId });
    const now = this.clock.now();
    const ipKey = ipRateLimitKey(input.ipAddress);
    const tenantKey = tenantRateLimitKey(actor.tenantId);
    const [ipWindow, tenantWindow] = await Promise.all([
      this.rateLimiter.peek(ipKey),
      this.rateLimiter.peek(tenantKey),
    ]);
    return {
      ip: toRateLimitWindowDto({
        key: 'ip',
        limit: this.globalLimitPerMinute,
        used: ipWindow.used,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
        ttlSeconds: ipWindow.ttlSeconds,
        now,
      }),
      tenant: toRateLimitWindowDto({
        key: 'tenant',
        limit: policy.rateLimitPerMinute || DEFAULT_RATE_LIMIT_PER_MINUTE,
        used: tenantWindow.used,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
        ttlSeconds: tenantWindow.ttlSeconds,
        now,
      }),
    };
  }
}

export class ConsumeRequestRateLimitUseCase {
  constructor(
    private readonly policies: SecurityPolicyRepository,
    private readonly rateLimiter: RateLimiterPort,
    private readonly globalLimitPerMinute: number,
  ) {}

  async execute(input: { readonly ipAddress: string; readonly tenantId?: string }): Promise<void> {
    await this.rateLimiter.consume(
      ipRateLimitKey(input.ipAddress),
      this.globalLimitPerMinute,
      RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!input.tenantId) {
      return;
    }
    const policy = await this.policies.findByTenant(input.tenantId);
    const limit = policy?.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
    await this.rateLimiter.consume(
      tenantRateLimitKey(input.tenantId),
      limit,
      RATE_LIMIT_WINDOW_SECONDS,
    );
  }
}
