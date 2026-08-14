import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { MembershipNotFoundError } from '../../domain/errors.js';
import { MemberRemovedEvent } from '../../domain/events.js';
import { createMembershipId } from '../../domain/membership-id.js';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';

export type RemoveMemberCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly membershipId: string;
  readonly security: RequestSecurityContext;
};

export class RemoveMemberUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly memberships: MembershipRepository,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<void> {
    const { membership: actor } = await this.tenantMemberships.execute(command.tenantId, command.actorId);
    const target = await this.memberships.findById(actor.organizationId, createMembershipId(command.membershipId));
    if (!target) {
      throw new MembershipNotFoundError();
    }

    const ownerCount = await this.memberships.countActiveOwners(actor.organizationId);
    MembershipPolicy.assertCanRemove({ actor, target, ownerCount });

    const now = this.clock.now();
    await this.memberships.delete(actor.organizationId, target.id);

    await this.auditLog.record({
      tenantId: actor.organizationId,
      actorId: command.actorId,
      action: OrganizationAuditActions.MEMBER_REMOVED,
      metadata: { membershipId: target.id, userId: target.userId, role: target.role },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new MemberRemovedEvent(
        crypto.randomUUID(),
        now,
        actor.organizationId,
        actor.organizationId,
        target.id,
        target.userId,
        command.security.correlationId,
      ),
    );
  }
}
