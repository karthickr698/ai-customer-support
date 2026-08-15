import type { EventBus } from '@ai-customer-support/shared';
import type { SecurityPolicyResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { SecurityPolicyUpdatedEvent } from '../../domain/events.js';
import { SecurityAuditEvent } from '../../domain/security-audit-event.js';
import { SecurityPolicy } from '../../domain/security-policy.js';
import { toPolicyDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  SecurityAuditRepository,
  SecurityPolicyRepository,
  TenantAccessPort,
} from '../ports.js';

export class ProvisionSecurityPolicyUseCase {
  constructor(
    private readonly policies: SecurityPolicyRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly tenantId: string }): Promise<SecurityPolicy> {
    const existing = await this.policies.findByTenant(input.tenantId);
    if (existing) {
      return existing;
    }
    const policy = SecurityPolicy.defaults(input.tenantId, this.clock.now());
    try {
      await this.policies.save(policy);
      return policy;
    } catch {
      const raced = await this.policies.findByTenant(input.tenantId);
      if (raced) {
        return raced;
      }
      throw new Error('Failed to provision security policy');
    }
  }
}

export class GetSecurityPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly provision: ProvisionSecurityPolicyUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<SecurityPolicyResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_READ);
    const policy = await this.provision.execute({ tenantId: actor.tenantId });
    return { policy: toPolicyDto(policy) };
  }
}

export class UpdateSecurityPolicyUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly policies: SecurityPolicyRepository,
    private readonly audit: SecurityAuditRepository,
    private readonly provision: ProvisionSecurityPolicyUseCase,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ipAllowlistEnabled?: boolean;
    readonly mfaRequired?: boolean;
    readonly sessionIdleTimeoutSeconds?: number;
    readonly maxRequestBytes?: number;
    readonly rateLimitPerMinute?: number;
    readonly auditRetentionDays?: number;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<SecurityPolicyResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const policy = await this.provision.execute({ tenantId: actor.tenantId });
    const now = this.clock.now();
    policy.update(
      {
        ipAllowlistEnabled: input.ipAllowlistEnabled,
        mfaRequired: input.mfaRequired,
        sessionIdleTimeoutSeconds: input.sessionIdleTimeoutSeconds,
        maxRequestBytes: input.maxRequestBytes,
        rateLimitPerMinute: input.rateLimitPerMinute,
        auditRetentionDays: input.auditRetentionDays,
      },
      now,
    );
    await this.policies.save(policy);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.policy.updated',
        resourceType: 'security_policy',
        resourceId: actor.tenantId,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: {
          ipAllowlistEnabled: policy.ipAllowlistEnabled,
          mfaRequired: policy.mfaRequired,
          rateLimitPerMinute: policy.rateLimitPerMinute,
        },
      }),
    );
    await this.eventBus.publish(
      new SecurityPolicyUpdatedEvent(crypto.randomUUID(), now, actor.tenantId, input.correlationId),
    );
    return { policy: toPolicyDto(policy) };
  }
}
