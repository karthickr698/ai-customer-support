import type { Prisma, PrismaClient } from '@prisma/client';
import type { RefreshSessionRepository } from '../../../application/ports/refresh-session-repository.js';
import { RefreshSession, type RefreshSessionSnapshot } from '../../../domain/refresh-session.js';
import { createUserId, type UserId } from '../../../domain/user-id.js';

export class PostgresRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(session: RefreshSession): Promise<void> {
    const snapshot = session.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.refreshSession.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
        revokedAt: data.revokedAt,
        replacedById: data.replacedById,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    const record = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });
    return record ? toSession(record) : null;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeAllForUser(userId: UserId, now: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
};

function toSession(record: SessionRecord): RefreshSession {
  const snapshot: RefreshSessionSnapshot = {
    id: record.id,
    userId: createUserId(record.userId),
    tokenHash: record.tokenHash,
    familyId: record.familyId,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt ?? undefined,
    replacedById: record.replacedById ?? undefined,
    createdAt: record.createdAt,
    userAgent: record.userAgent ?? undefined,
    ipAddress: record.ipAddress ?? undefined,
  };

  return RefreshSession.reconstitute(snapshot);
}

function toRecord(snapshot: RefreshSessionSnapshot): Prisma.RefreshSessionUncheckedCreateInput {
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    tokenHash: snapshot.tokenHash,
    familyId: snapshot.familyId,
    expiresAt: snapshot.expiresAt,
    revokedAt: snapshot.revokedAt ?? null,
    replacedById: snapshot.replacedById ?? null,
    createdAt: snapshot.createdAt,
    userAgent: snapshot.userAgent ?? null,
    ipAddress: snapshot.ipAddress ?? null,
  };
}
