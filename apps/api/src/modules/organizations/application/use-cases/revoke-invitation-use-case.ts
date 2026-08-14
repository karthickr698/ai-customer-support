import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { InvitationNotFoundError } from '../../domain/errors.js';
import { InvitationRevokedEvent } from '../../domain/events.js';
import { createInvitationId } from '../../domain/invitation-id.js';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { Permissions } from '../../domain/permissions.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { InvitationRepository } from '../ports/invitation-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';

export type RevokeInvitationCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly invitationId: string;
  readonly security: RequestSecurityContext;
};

export class RevokeInvitationUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly invitations: InvitationRepository,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RevokeInvitationCommand): Promise<void> {
    const { membership } = await this.tenantMemberships.execute(command.tenantId, command.actorId);
    MembershipPolicy.assertPermission(membership.role, Permissions.ORGANIZATION_INVITATIONS_MANAGE);

    const invitation = await this.invitations.findById(
      membership.organizationId,
      createInvitationId(command.invitationId),
    );
    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    const now = this.clock.now();
    invitation.revoke(now);
    await this.invitations.save(invitation);

    await this.auditLog.record({
      tenantId: membership.organizationId,
      actorId: command.actorId,
      action: OrganizationAuditActions.INVITATION_REVOKED,
      metadata: { invitationId: invitation.id, email: invitation.email.value },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new InvitationRevokedEvent(
        crypto.randomUUID(),
        now,
        membership.organizationId,
        membership.organizationId,
        invitation.id,
        command.security.correlationId,
      ),
    );
  }
}
