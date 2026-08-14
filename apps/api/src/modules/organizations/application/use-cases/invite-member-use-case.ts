import type { OrganizationInvitationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { EmailAddress } from '../../domain/email-address.js';
import { AlreadyOrganizationMemberError, InvitationAlreadyPendingError } from '../../domain/errors.js';
import { MemberInvitedEvent } from '../../domain/events.js';
import { Invitation } from '../../domain/invitation.js';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { Permissions } from '../../domain/permissions.js';
import { addSeconds, toInvitationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import { ORGANIZATION_RATE_LIMITS } from '../rate-limits.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { InvitationEmailPort } from '../ports/invitation-email-port.js';
import type { InvitationRepository } from '../ports/invitation-repository.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { SecureTokenGeneratorPort } from '../ports/secure-token-generator-port.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export type InviteMemberCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly email: string;
  readonly role: string;
  readonly security: RequestSecurityContext;
};

export class InviteMemberUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly memberships: MembershipRepository,
    private readonly invitations: InvitationRepository,
    private readonly users: UserDirectoryPort,
    private readonly emailSender: InvitationEmailPort,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly webOrigin: string,
    private readonly invitationTtlSeconds: number,
  ) {}

  async execute(command: InviteMemberCommand): Promise<{ invitation: OrganizationInvitationDto }> {
    const { organization, membership: actor } = await this.tenantMemberships.execute(
      command.tenantId,
      command.actorId,
    );
    MembershipPolicy.assertPermission(actor.role, Permissions.ORGANIZATION_INVITATIONS_MANAGE);

    await this.rateLimiter.consume(
      `org:invite:${organization.id}`,
      ORGANIZATION_RATE_LIMITS.inviteMember.limit,
      ORGANIZATION_RATE_LIMITS.inviteMember.windowSeconds,
    );

    const email = EmailAddress.parse(command.email);
    const existingUser = await this.users.findByEmail(email.value);
    if (existingUser) {
      const existingMembership = await this.memberships.findByUser(organization.id, existingUser.id);
      if (existingMembership) {
        throw new AlreadyOrganizationMemberError();
      }
    }

    const pending = await this.invitations.findPendingByEmail(organization.id, email);
    if (pending) {
      throw new InvitationAlreadyPendingError();
    }

    const now = this.clock.now();
    const token = this.tokenGenerator.generate();
    const invitation = Invitation.issue({
      organizationId: organization.id,
      email,
      role: command.role,
      tokenHash: this.tokenHasher.hash(token),
      invitedByUserId: command.actorId,
      expiresAt: addSeconds(now, this.invitationTtlSeconds),
      now,
    });

    await this.invitations.save(invitation);

    await this.emailSender.sendInvitation({
      to: email.value,
      organizationName: organization.name,
      role: invitation.role,
      acceptUrl: `${this.webOrigin}/invitations/accept?token=${encodeURIComponent(token)}`,
    });

    await this.auditLog.record({
      tenantId: organization.id,
      actorId: command.actorId,
      action: OrganizationAuditActions.MEMBER_INVITED,
      metadata: { invitationId: invitation.id, email: email.value, role: invitation.role },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new MemberInvitedEvent(
        crypto.randomUUID(),
        now,
        organization.id,
        organization.id,
        invitation.id,
        email.value,
        invitation.role,
        command.security.correlationId,
      ),
    );

    return { invitation: toInvitationDto(invitation) };
  }
}
