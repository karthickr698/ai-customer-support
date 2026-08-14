import type { OrganizationMemberDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { InvalidOrganizationRoleError, MembershipNotFoundError } from '../../domain/errors.js';
import { MemberRoleChangedEvent } from '../../domain/events.js';
import { createMembershipId } from '../../domain/membership-id.js';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { isOrganizationRole } from '../../domain/permissions.js';
import { toMemberDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export type ChangeMemberRoleCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly membershipId: string;
  readonly role: string;
  readonly security: RequestSecurityContext;
};

export class ChangeMemberRoleUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ChangeMemberRoleCommand): Promise<{ member: OrganizationMemberDto }> {
    const { membership: actor } = await this.tenantMemberships.execute(command.tenantId, command.actorId);
    if (!isOrganizationRole(command.role)) {
      throw new InvalidOrganizationRoleError();
    }

    const target = await this.memberships.findById(actor.organizationId, createMembershipId(command.membershipId));
    if (!target) {
      throw new MembershipNotFoundError();
    }

    const ownerCount = await this.memberships.countActiveOwners(actor.organizationId);
    MembershipPolicy.assertCanChangeRole({
      actor,
      target,
      nextRole: command.role,
      ownerCount,
    });

    const now = this.clock.now();
    target.changeRole(command.role, now);
    await this.memberships.save(target);

    await this.auditLog.record({
      tenantId: actor.organizationId,
      actorId: command.actorId,
      action: OrganizationAuditActions.MEMBER_ROLE_CHANGED,
      metadata: { membershipId: target.id, userId: target.userId, role: target.role },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new MemberRoleChangedEvent(
        crypto.randomUUID(),
        now,
        actor.organizationId,
        actor.organizationId,
        target.id,
        target.userId,
        target.role,
        command.security.correlationId,
      ),
    );

    const user = await this.users.findById(target.userId);
    return { member: toMemberDto(target, user) };
  }
}
