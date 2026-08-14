import type { OrganizationMemberDto } from '@ai-customer-support/contracts';
import { MembershipPolicy } from '../../domain/membership-policy.js';
import { Permissions } from '../../domain/permissions.js';
import { toMemberDto } from '../dtos.js';
import type { LoadTenantMembershipService } from '../load-tenant-membership-service.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class ListMembersUseCase {
  constructor(
    private readonly tenantMemberships: LoadTenantMembershipService,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<{ members: OrganizationMemberDto[] }> {
    const { membership: actor } = await this.tenantMemberships.execute(input.tenantId, input.actorId);
    MembershipPolicy.assertPermission(actor.role, Permissions.ORGANIZATION_READ);

    const memberships = await this.memberships.listByOrganization(actor.organizationId);
    const members: OrganizationMemberDto[] = [];

    for (const membership of memberships) {
      const user = await this.users.findById(membership.userId);
      members.push(toMemberDto(membership, user));
    }

    return { members };
  }
}
