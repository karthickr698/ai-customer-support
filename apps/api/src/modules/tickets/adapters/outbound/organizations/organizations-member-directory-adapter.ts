import type { OrganizationMemberQuery } from '../../../../organizations/application/organization-member-query.js';
import type {
  OrganizationMemberDirectoryPort,
  OrganizationMemberRecord,
} from '../../../application/ports.js';

export class OrganizationsMemberDirectoryAdapter implements OrganizationMemberDirectoryPort {
  constructor(private readonly members: OrganizationMemberQuery) {}

  async findActiveMember(tenantId: string, userId: string): Promise<OrganizationMemberRecord | null> {
    const member = await this.members.findActiveMember(tenantId, userId);
    if (!member) {
      return null;
    }
    return { userId: member.userId, role: member.role };
  }

  async listActiveMembers(tenantId: string): Promise<OrganizationMemberRecord[]> {
    const members = await this.members.listActiveMembers(tenantId);
    return members.map((member) => ({ userId: member.userId, role: member.role }));
  }
}
