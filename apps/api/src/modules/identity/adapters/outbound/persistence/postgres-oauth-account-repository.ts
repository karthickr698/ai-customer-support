import type { Prisma, PrismaClient } from '@prisma/client';
import type { OAuthAccountRepository } from '../../../application/ports/oauth-account-repository.js';
import {
  GOOGLE_OAUTH_PROVIDER,
  OAuthAccount,
  type OAuthAccountSnapshot,
} from '../../../domain/oauth-account.js';
import { createUserId } from '../../../domain/user-id.js';

export class PostgresOAuthAccountRepository implements OAuthAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(account: OAuthAccount): Promise<void> {
    const snapshot = account.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: snapshot.provider,
          providerAccountId: snapshot.providerAccountId,
        },
      },
      create: data,
      update: { userId: data.userId },
    });
  }

  async findByGoogleAccountId(providerAccountId: string): Promise<OAuthAccount | null> {
    const record = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_OAUTH_PROVIDER,
          providerAccountId,
        },
      },
    });

    return record ? toAccount(record) : null;
  }
}

type AccountRecord = {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  createdAt: Date;
};

function toAccount(record: AccountRecord): OAuthAccount | null {
  if (record.provider !== GOOGLE_OAUTH_PROVIDER) {
    return null;
  }

  const snapshot: OAuthAccountSnapshot = {
    id: record.id,
    userId: createUserId(record.userId),
    provider: GOOGLE_OAUTH_PROVIDER,
    providerAccountId: record.providerAccountId,
    createdAt: record.createdAt,
  };

  return OAuthAccount.reconstitute(snapshot);
}

function toRecord(snapshot: OAuthAccountSnapshot): Prisma.OAuthAccountUncheckedCreateInput {
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    provider: snapshot.provider,
    providerAccountId: snapshot.providerAccountId,
    createdAt: snapshot.createdAt,
  };
}
