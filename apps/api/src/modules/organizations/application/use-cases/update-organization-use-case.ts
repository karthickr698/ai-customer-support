import type { OrganizationWithMembershipDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { OrganizationAuditActions } from '../../domain/audit-actions.js';
import { OrganizationSlugTakenError } from '../../domain/errors.js';
import { OrganizationUpdatedEvent } from '../../domain/events.js';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { OrganizationSlug } from '../../domain/organization-slug.js';
import { Permissions } from '../../domain/permissions.js';
import { toOrganizationWithMembershipDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OrganizationAuditLogPort } from '../ports/organization-audit-log-port.js';
import type { OrganizationRepository } from '../ports/organization-repository.js';

export type UpdateOrganizationCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly name?: string;
  readonly slug?: string;
  readonly security: RequestSecurityContext;
};

export class UpdateOrganizationUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly organizations: OrganizationRepository,
    private readonly auditLog: OrganizationAuditLogPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateOrganizationCommand): Promise<{ organization: OrganizationWithMembershipDto }> {
    const { organization, membership } = await this.tenantMemberships.execute(command.tenantId, command.actorId);
    MembershipPolicy.assertPermission(membership.role, Permissions.ORGANIZATION_UPDATE);

    const now = this.clock.now();

    if (command.name !== undefined) {
      organization.rename(command.name, now);
    }

    if (command.slug !== undefined) {
      const slug = OrganizationSlug.parse(command.slug);
      const existing = await this.organizations.findBySlug(slug);
      if (existing && existing.id !== organization.id) {
        throw new OrganizationSlugTakenError();
      }

      organization.changeSlug(slug, now);
    }

    await this.organizations.save(organization);

    await this.auditLog.record({
      tenantId: organization.id,
      actorId: command.actorId,
      action: OrganizationAuditActions.ORGANIZATION_UPDATED,
      metadata: { name: organization.name, slug: organization.slug.value },
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new OrganizationUpdatedEvent(
        crypto.randomUUID(),
        now,
        organization.id,
        organization.id,
        command.security.correlationId,
      ),
    );

    return { organization: toOrganizationWithMembershipDto(organization, membership) };
  }
}
