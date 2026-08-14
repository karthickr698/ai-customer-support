import type { OrganizationWithMembershipDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import {
  AlreadyOrganizationMemberError,
  InvalidInvitationTokenError,
  InvitationEmailMismatchError,
  OrganizationNotFoundError,
} from '../../domain/errors.js';
import { InvitationAcceptedEvent } from '../../domain/events.js';
import { Membership } from '../../domain/membership.js';
import { toOrganizationWithMembershipDto, type RequestSecurityContext } from '../dtos.js';
import { ORGANIZATION_RATE_LIMITS } from '../rate-limits.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { InvitationRepository } from '../ports/invitation-repository.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';
import type { OrganizationRepository } from '../ports/organization-repository.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';

export type AcceptInvitationCommand = {
  readonly actorId: string;
  readonly actorEmail: string;
  readonly token: string;
  readonly security: RequestSecurityContext;
};

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly tokenHasher: TokenHasherPort,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: AcceptInvitationCommand,
  ): Promise<{ organization: OrganizationWithMembershipDto }> {
    await this.rateLimiter.consume(
      `org:invite-accept:ip:${command.security.ipAddress}`,
      ORGANIZATION_RATE_LIMITS.acceptInvitationIp.limit,
      ORGANIZATION_RATE_LIMITS.acceptInvitationIp.windowSeconds,
    );

    const invitation = await this.invitations.findByTokenHash(this.tokenHasher.hash(command.token));
    if (!invitation) {
      throw new InvalidInvitationTokenError();
    }

    const now = this.clock.now();
    invitation.assertAcceptable(now);

    if (invitation.email.value !== command.actorEmail.trim().toLowerCase()) {
      throw new InvitationEmailMismatchError();
    }

    const organization = await this.organizations.findById(invitation.organizationId);
    if (!organization) {
      throw new OrganizationNotFoundError();
    }

    organization.assertActive();

    const existing = await this.memberships.findByUser(organization.id, command.actorId);
    if (existing) {
      throw new AlreadyOrganizationMemberError();
    }

    const membership = Membership.create({
      organizationId: organization.id,
      userId: command.actorId,
      role: invitation.role,
      now,
    });

    invitation.accept(now);
    await this.invitations.save(invitation);
    await this.memberships.save(membership);

    await this.auditLog.record({
      tenantId: organization.id,
      actorId: command.actorId,
      action: OrganizationAuditActions.INVITATION_ACCEPTED,
      metadata: { invitationId: invitation.id, membershipId: membership.id, role: membership.role },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new InvitationAcceptedEvent(
        crypto.randomUUID(),
        now,
        organization.id,
        organization.id,
        invitation.id,
        command.actorId,
        command.security.correlationId,
      ),
    );

    return { organization: toOrganizationWithMembershipDto(organization, membership) };
  }
}
