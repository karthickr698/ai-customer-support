import type { Prisma, PrismaClient } from '@prisma/client';
import { Membership, type MembershipSnapshot, type MembershipStatus } from '../../../domain/membership.js';
import { createMembershipId, type MembershipId } from '../../../domain/membership-id.js';
import { createOrganizationId, type OrganizationId } from '../../../domain/organization-id.js';
import { isOrganizationRole } from '../../../domain/permissions.js';
import type { MembershipRepository } from '../../../application/ports/membership-repository.js';

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(membership: Membership): Promise<void> {
    const snapshot = membership.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.membership.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        role: data.role,
        status: data.status,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: OrganizationId, membershipId: MembershipId): Promise<Membership | null> {
    const record = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: tenantId },
    });
    return record ? toMembership(record) : null;
  }

  async findByUser(tenantId: OrganizationId, userId: string): Promise<Membership | null> {
    const record = await this.prisma.membership.findFirst({
      where: { organizationId: tenantId, userId },
    });
    return record ? toMembership(record) : null;
  }

  async listByOrganization(tenantId: OrganizationId): Promise<Membership[]> {
    const records = await this.prisma.membership.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toMembership);
  }

  async listByUser(userId: string): Promise<Membership[]> {
    const records = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toMembership);
  }

  async countActiveOwners(tenantId: OrganizationId): Promise<number> {
    return this.prisma.membership.count({
      where: { organizationId: tenantId, role: 'owner', status: 'active' },
    });
  }

  async delete(tenantId: OrganizationId, membershipId: MembershipId): Promise<void> {
    await this.prisma.membership.deleteMany({
      where: { id: membershipId, organizationId: tenantId },
    });
  }
}

type MembershipRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toMembership(record: MembershipRecord): Membership {
  const snapshot: MembershipSnapshot = {
    id: createMembershipId(record.id),
    organizationId: createOrganizationId(record.organizationId),
    userId: record.userId,
    role: isOrganizationRole(record.role) ? record.role : 'viewer',
    status: record.status === 'disabled' ? 'disabled' : 'active',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  return Membership.reconstitute(snapshot);
}

function toRecord(snapshot: MembershipSnapshot): Prisma.MembershipUncheckedCreateInput {
  const status: MembershipStatus = snapshot.status;

  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    userId: snapshot.userId,
    role: snapshot.role,
    status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
