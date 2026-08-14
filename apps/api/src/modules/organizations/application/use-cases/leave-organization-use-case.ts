import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { MemberLeftEvent } from '../../domain/events.js';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';

export type LeaveOrganizationCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly security: RequestSecurityContext;
};

export class LeaveOrganizationUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly memberships: MembershipRepository,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: LeaveOrganizationCommand): Promise<void> {
    const { membership } = await this.tenantMemberships.execute(command.tenantId, command.actorId);
    const ownerCount = await this.memberships.countActiveOwners(membership.organizationId);
    MembershipPolicy.assertCanLeave({ membership, ownerCount });

    const now = this.clock.now();
    await this.memberships.delete(membership.organizationId, membership.id);

    await this.auditLog.record({
      tenantId: membership.organizationId,
      actorId: command.actorId,
      action: OrganizationAuditActions.MEMBER_LEFT,
      metadata: { membershipId: membership.id, role: membership.role },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new MemberLeftEvent(
        crypto.randomUUID(),
        now,
        membership.organizationId,
        membership.organizationId,
        membership.id,
        command.actorId,
        command.security.correlationId,
      ),
    );
  }
}
