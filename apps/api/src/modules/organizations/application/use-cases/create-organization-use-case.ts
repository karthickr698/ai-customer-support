import type { OrganizationWithMembershipDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { OrganizationCreatedEvent } from '../../domain/events.js';
import { Membership } from '../../domain/membership.js';
import { Organization } from '../../domain/organization.js';
import { OrganizationSlug } from '../../domain/organization-slug.js';
import { toOrganizationWithMembershipDto, type RequestSecurityContext } from '../dtos.js';
import { ORGANIZATION_RATE_LIMITS } from '../rate-limits.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';
import type { OrganizationRepository } from '../ports/organization-repository.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';

export type CreateOrganizationCommand = {
  readonly actorId: string;
  readonly name: string;
  readonly security: RequestSecurityContext;
};

export class CreateOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<{ organization: OrganizationWithMembershipDto }> {
    await this.rateLimiter.consume(
      `org:create:user:${command.actorId}`,
      ORGANIZATION_RATE_LIMITS.createOrganization.limit,
      ORGANIZATION_RATE_LIMITS.createOrganization.windowSeconds,
    );

    const now = this.clock.now();
    let slug = OrganizationSlug.fromName(command.name);

    while (await this.organizations.findBySlug(slug)) {
      slug = slug.withUniqueSuffix();
    }

    const organization = Organization.create({
      name: command.name,
      slug,
      now,
    });
    const membership = Membership.create({
      organizationId: organization.id,
      userId: command.actorId,
      role: 'owner',
      now,
    });

    await this.organizations.save(organization);
    await this.memberships.save(membership);

    await this.auditLog.record({
      tenantId: organization.id,
      actorId: command.actorId,
      action: OrganizationAuditActions.ORGANIZATION_CREATED,
      metadata: { name: organization.name, slug: organization.slug.value },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new OrganizationCreatedEvent(
        crypto.randomUUID(),
        now,
        organization.id,
        organization.id,
        command.actorId,
        command.security.correlationId,
      ),
    );

    return { organization: toOrganizationWithMembershipDto(organization, membership) };
  }
}
