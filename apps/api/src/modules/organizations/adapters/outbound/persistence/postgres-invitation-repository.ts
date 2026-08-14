import type { Prisma, PrismaClient } from '@prisma/client';
import { EmailAddress } from '../../../domain/email-address.js';
import { InvitationAlreadyPendingError } from '../../../domain/errors.js';
import { Invitation, type InvitationSnapshot } from '../../../domain/invitation.js';
import { createInvitationId, type InvitationId } from '../../../domain/invitation-id.js';
import { createOrganizationId, type OrganizationId } from '../../../domain/organization-id.js';
import { isAssignableMemberRole } from '../../../domain/permissions.js';
import type { InvitationRepository } from '../../../application/ports/invitation-repository.js';

export class PostgresInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(invitation: Invitation): Promise<void> {
    const snapshot = invitation.toSnapshot();
    const data = toRecord(snapshot);

    try {
      await this.prisma.invitation.upsert({
        where: { id: snapshot.id },
        create: data,
        update: {
          acceptedAt: data.acceptedAt,
          revokedAt: data.revokedAt,
        },
      });
    } catch (error: unknown) {
      if (isUniqueConstraint(error)) {
        throw new InvitationAlreadyPendingError();
      }

      throw error;
    }
  }

  async findById(tenantId: OrganizationId, invitationId: InvitationId): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: tenantId },
    });
    return record ? toInvitation(record) : null;
  }

  async findPendingByEmail(tenantId: OrganizationId, email: EmailAddress): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findFirst({
      where: {
        organizationId: tenantId,
        email: email.value,
        acceptedAt: null,
        revokedAt: null,
      },
    });
    return record ? toInvitation(record) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    return record ? toInvitation(record) : null;
  }

  async listPendingByOrganization(tenantId: OrganizationId, now: Date): Promise<Invitation[]> {
    const records = await this.prisma.invitation.findMany({
      where: {
        organizationId: tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toInvitation);
  }
}

type InvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  tokenHash: string;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

function toInvitation(record: InvitationRecord): Invitation {
  if (!isAssignableMemberRole(record.role)) {
    throw new Error('Stored invitation has an invalid role');
  }

  const snapshot: InvitationSnapshot = {
    id: createInvitationId(record.id),
    organizationId: createOrganizationId(record.organizationId),
    email: record.email,
    role: record.role,
    tokenHash: record.tokenHash,
    invitedByUserId: record.invitedByUserId,
    expiresAt: record.expiresAt,
    acceptedAt: record.acceptedAt ?? undefined,
    revokedAt: record.revokedAt ?? undefined,
    createdAt: record.createdAt,
  };

  return Invitation.reconstitute(snapshot);
}

function toRecord(snapshot: InvitationSnapshot): Prisma.InvitationUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    email: snapshot.email,
    role: snapshot.role,
    tokenHash: snapshot.tokenHash,
    invitedByUserId: snapshot.invitedByUserId,
    expiresAt: snapshot.expiresAt,
    acceptedAt: snapshot.acceptedAt ?? null,
    revokedAt: snapshot.revokedAt ?? null,
    createdAt: snapshot.createdAt,
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
