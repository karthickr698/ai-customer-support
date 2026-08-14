import type { OrganizationInvitationDto } from '@ai-customer-support/contracts';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { Permissions } from '../../domain/permissions.js';
import { toInvitationDto } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { InvitationRepository } from '../ports/invitation-repository.js';

export class ListInvitationsUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly invitations: InvitationRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<{ invitations: OrganizationInvitationDto[] }> {
    const { membership } = await this.tenantMemberships.execute(input.tenantId, input.actorId);
    MembershipPolicy.assertPermission(membership.role, Permissions.ORGANIZATION_INVITATIONS_MANAGE);

    const invitations = await this.invitations.listPendingByOrganization(
      membership.organizationId,
      this.clock.now(),
    );

    return { invitations: invitations.map(toInvitationDto) };
  }
}
