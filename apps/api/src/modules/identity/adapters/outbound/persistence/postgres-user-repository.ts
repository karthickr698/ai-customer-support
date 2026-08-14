import type { Prisma, PrismaClient } from '@prisma/client';
import { EmailAddress } from '../../../domain/email-address.js';
import { User, type UserSnapshot, type UserStatus } from '../../../domain/user.js';
import { createUserId } from '../../../domain/user-id.js';
import type { UserRepository } from '../../../application/ports/user-repository.js';

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? toUser(record) : null;
  }

  async findByEmail(email: EmailAddress): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email: email.value } });
    return record ? toUser(record) : null;
  }

  async save(user: User): Promise<void> {
    const snapshot = user.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.user.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        emailVerifiedAt: data.emailVerifiedAt,
        status: data.status,
        updatedAt: data.updatedAt,
      },
    });
  }
}

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  emailVerifiedAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toUser(record: UserRecord): User {
  const snapshot: UserSnapshot = {
    id: createUserId(record.id),
    email: record.email,
    passwordHash: record.passwordHash ?? undefined,
    displayName: record.displayName,
    emailVerifiedAt: record.emailVerifiedAt ?? undefined,
    status: record.status === 'disabled' ? 'disabled' : 'active',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  return User.reconstitute(snapshot);
}

function toRecord(snapshot: UserSnapshot): Prisma.UserUncheckedCreateInput {
  const status: UserStatus = snapshot.status;

  return {
    id: snapshot.id,
    email: snapshot.email,
    passwordHash: snapshot.passwordHash ?? null,
    displayName: snapshot.displayName,
    emailVerifiedAt: snapshot.emailVerifiedAt ?? null,
    status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
