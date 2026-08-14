import type { Prisma, PrismaClient } from '@prisma/client';
import type { OneTimeTokenRepository } from '../../../application/ports/one-time-token-repository.js';
import {
  OneTimeToken,
  type OneTimeTokenPurpose,
  type OneTimeTokenSnapshot,
} from '../../../domain/one-time-token.js';
import { createUserId, type UserId } from '../../../domain/user-id.js';

export class PostgresOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(token: OneTimeToken): Promise<void> {
    const snapshot = token.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.authOneTimeToken.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        consumedAt: data.consumedAt,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findValidByHash(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<OneTimeToken | null> {
    const record = await this.prisma.authOneTimeToken.findUnique({ where: { tokenHash } });
    if (!record || record.purpose !== purpose) {
      return null;
    }

    const token = toToken(record);
    return token.isUsable(now) ? token : null;
  }

  async deleteUnusedForUser(purpose: OneTimeTokenPurpose, userId: UserId): Promise<void> {
    await this.prisma.authOneTimeToken.deleteMany({
      where: { userId, purpose, consumedAt: null },
    });
  }
}

type TokenRecord = {
  id: string;
  userId: string;
  purpose: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

function toToken(record: TokenRecord): OneTimeToken {
  const purpose: OneTimeTokenPurpose =
    record.purpose === 'password_reset' ? 'password_reset' : 'email_verification';

  const snapshot: OneTimeTokenSnapshot = {
    id: record.id,
    userId: createUserId(record.userId),
    purpose,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    consumedAt: record.consumedAt ?? undefined,
    createdAt: record.createdAt,
  };

  return OneTimeToken.reconstitute(snapshot);
}

function toRecord(snapshot: OneTimeTokenSnapshot): Prisma.AuthOneTimeTokenUncheckedCreateInput {
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    purpose: snapshot.purpose,
    tokenHash: snapshot.tokenHash,
    expiresAt: snapshot.expiresAt,
    consumedAt: snapshot.consumedAt ?? null,
    createdAt: snapshot.createdAt,
  };
}
