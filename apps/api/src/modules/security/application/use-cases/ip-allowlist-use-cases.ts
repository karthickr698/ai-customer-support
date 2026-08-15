import type { EventBus } from '@ai-customer-support/shared';
import type {
  SecurityIpAllowlistEntryResponse,
  SecurityIpAllowlistResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import {
  DuplicateSecurityIpAllowlistEntryError,
  IpNotAllowedError,
  SecurityIpAllowlistEntryNotFoundError,
  TooManySecurityRecordsError,
} from '../../domain/errors.js';
import { SecurityIpAllowlistChangedEvent } from '../../domain/events.js';
import { createSecurityIpAllowlistEntryId } from '../../domain/ids.js';
import { SecurityIpAllowlistEntry } from '../../domain/ip-allowlist-entry.js';
import { MAX_IP_ALLOWLIST_ENTRIES } from '../../domain/security-controls.js';
import { SecurityAuditEvent } from '../../domain/security-audit-event.js';
import { SecurityPolicy } from '../../domain/security-policy.js';
import { ipAllowed, isUuid } from '../../domain/values.js';
import { toIpAllowlistDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  SecurityAuditRepository,
  SecurityIpAllowlistRepository,
  SecurityPolicyRepository,
  TenantAccessPort,
} from '../ports.js';
import { ProvisionSecurityPolicyUseCase } from './policy-use-cases.js';

export class ListSecurityIpAllowlistUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly allowlist: SecurityIpAllowlistRepository,
    private readonly provision: ProvisionSecurityPolicyUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<SecurityIpAllowlistResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_READ);
    const policy = await this.provision.execute({ tenantId: actor.tenantId });
    const items = await this.allowlist.listByTenant(actor.tenantId);
    return {
      enabled: policy.ipAllowlistEnabled,
      items: items.filter((entry) => entry.belongsTo(actor.tenantId)).map(toIpAllowlistDto),
    };
  }
}

export class AddSecurityIpAllowlistEntryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly allowlist: SecurityIpAllowlistRepository,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly cidr: string;
    readonly label?: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<SecurityIpAllowlistEntryResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    const count = await this.allowlist.countByTenant(actor.tenantId);
    if (count >= MAX_IP_ALLOWLIST_ENTRIES) {
      throw new TooManySecurityRecordsError(
        `At most ${MAX_IP_ALLOWLIST_ENTRIES} IP allowlist entries are allowed`,
      );
    }
    const now = this.clock.now();
    const entry = SecurityIpAllowlistEntry.create({
      organizationId: actor.tenantId,
      cidr: input.cidr,
      label: input.label,
      createdBy: actor.actorId,
      now,
    });
    const existing = await this.allowlist.findByCidr(actor.tenantId, entry.cidr);
    if (existing) {
      throw new DuplicateSecurityIpAllowlistEntryError();
    }
    await this.allowlist.save(entry);
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.ip_allowlist.added',
        resourceType: 'ip_allowlist',
        resourceId: entry.id,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { cidr: entry.cidr },
      }),
    );
    await this.eventBus.publish(
      new SecurityIpAllowlistChangedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        'added',
        entry.cidr,
        input.correlationId,
      ),
    );
    return { entry: toIpAllowlistDto(entry) };
  }
}

export class RemoveSecurityIpAllowlistEntryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly allowlist: SecurityIpAllowlistRepository,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly entryId: string;
    readonly security?: RequestSecurityContext;
    readonly correlationId?: string;
  }): Promise<{ readonly removed: true }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    SecurityPolicy.assertPermission(actor.permissions, Permissions.SECURITY_MANAGE);
    if (!isUuid(input.entryId)) {
      throw new SecurityIpAllowlistEntryNotFoundError();
    }
    const entry = await this.allowlist.findById(
      actor.tenantId,
      createSecurityIpAllowlistEntryId(input.entryId),
    );
    if (!entry || !entry.belongsTo(actor.tenantId)) {
      throw new SecurityIpAllowlistEntryNotFoundError();
    }
    await this.allowlist.delete(actor.tenantId, entry.id);
    const now = this.clock.now();
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: actor.tenantId,
        actorId: actor.actorId,
        action: 'security.ip_allowlist.removed',
        resourceType: 'ip_allowlist',
        resourceId: entry.id,
        outcome: 'success',
        occurredAt: now,
        ipAddress: input.security?.ipAddress,
        userAgent: input.security?.userAgent,
        requestId: input.security?.requestId,
        metadata: { cidr: entry.cidr },
      }),
    );
    await this.eventBus.publish(
      new SecurityIpAllowlistChangedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        'removed',
        entry.cidr,
        input.correlationId,
      ),
    );
    return { removed: true };
  }
}

export class EnforceIpAllowlistUseCase {
  constructor(
    private readonly policies: SecurityPolicyRepository,
    private readonly allowlist: SecurityIpAllowlistRepository,
    private readonly audit: SecurityAuditRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly ipAddress: string;
    readonly requestId?: string;
    readonly userAgent?: string;
  }): Promise<void> {
    const policy = await this.policies.findByTenant(input.tenantId);
    if (!policy || !policy.ipAllowlistEnabled) {
      return;
    }
    const entries = await this.allowlist.listByTenant(input.tenantId);
    const cidrs = entries.map((entry) => entry.cidr);
    if (ipAllowed(input.ipAddress, cidrs)) {
      return;
    }
    await this.audit.save(
      SecurityAuditEvent.create({
        organizationId: input.tenantId,
        action: 'security.authorization.denied',
        resourceType: 'ip_allowlist',
        outcome: 'denied',
        occurredAt: this.clock.now(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: { reason: 'ip_not_allowed' },
      }),
    );
    throw new IpNotAllowedError();
  }
}
