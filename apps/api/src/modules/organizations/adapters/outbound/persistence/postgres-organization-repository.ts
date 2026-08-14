import type { Prisma, PrismaClient } from '@prisma/client';
import { Organization, type OrganizationSnapshot, type OrganizationStatus } from '../../../domain/organization.js';
import { createOrganizationId, type OrganizationId } from '../../../domain/organization-id.js';
import { OrganizationSlug } from '../../../domain/organization-slug.js';
import { OrganizationSlugTakenError } from '../../../domain/errors.js';
import type { OrganizationRepository } from '../../../application/ports/organization-repository.js';

export class PostgresOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: OrganizationId): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    return record ? toOrganization(record) : null;
  }

  async findBySlug(slug: OrganizationSlug): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { slug: slug.value } });
    return record ? toOrganization(record) : null;
  }

  async findByIds(ids: readonly OrganizationId[]): Promise<Organization[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.organization.findMany({
      where: { id: { in: [...ids] } },
    });

    return records.map(toOrganization);
  }

  async save(organization: Organization): Promise<void> {
    const snapshot = organization.toSnapshot();
    const data = toRecord(snapshot);

    try {
      await this.prisma.organization.upsert({
        where: { id: snapshot.id },
        create: data,
        update: {
          name: data.name,
          slug: data.slug,
          status: data.status,
          updatedAt: data.updatedAt,
        },
      });
    } catch (error: unknown) {
      if (isUniqueConstraint(error)) {
        throw new OrganizationSlugTakenError();
      }

      throw error;
    }
  }
}

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toOrganization(record: OrganizationRecord): Organization {
  const snapshot: OrganizationSnapshot = {
    id: createOrganizationId(record.id),
    name: record.name,
    slug: record.slug,
    status: record.status === 'disabled' ? 'disabled' : 'active',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  return Organization.reconstitute(snapshot);
}

function toRecord(snapshot: OrganizationSnapshot): Prisma.OrganizationUncheckedCreateInput {
  const status: OrganizationStatus = snapshot.status;

  return {
    id: snapshot.id,
    name: snapshot.name,
    slug: snapshot.slug,
    status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
