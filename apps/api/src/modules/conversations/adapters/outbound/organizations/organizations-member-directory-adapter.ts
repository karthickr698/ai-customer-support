import type { OrganizationMemberQuery } from '../../../../organizations/application/organization-member-query.js';
import type {
  OrganizationMemberDirectoryPort,
  OrganizationMemberRecord,
} from '../../../application/ports/organization-member-directory-port.js';

export class OrganizationsMemberDirectoryAdapter implements OrganizationMemberDirectoryPort {
  constructor(private readonly members: OrganizationMemberQuery) {}

  async findActiveMember(
    tenantId: string,
    userId: string,
  ): Promise<OrganizationMemberRecord | null> {
    const member = await this.members.findActiveMember(tenantId, userId);
    if (!member) {
      return null;
    }

    return {
      userId: member.userId,
      role: member.role,
    };
  }
}
