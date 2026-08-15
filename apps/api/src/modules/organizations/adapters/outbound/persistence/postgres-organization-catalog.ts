import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createOrganizationId } from '../../../domain/organization-id.js';
import type {
  OrganizationCatalogFilter,
  OrganizationCatalogPort,
  OrganizationCatalogRecord,
} from '../../../application/ports/organization-catalog-port.js';

export class PostgresOrganizationCatalog implements OrganizationCatalogPort {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    page: PageRequest,
    filter?: OrganizationCatalogFilter,
  ): Promise<Page<OrganizationCatalogRecord>> {
    const where = toWhere(filter);
    const skip = (page.page - 1) * page.pageSize;
    const [total, records] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        skip,
        take: page.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { memberships: true } } },
      }),
    ]);

    return {
      items: records.map(toCatalogRecord),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async findSummary(id: ReturnType<typeof createOrganizationId>): Promise<OrganizationCatalogRecord | null> {
    const record = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { memberships: true } } },
    });
    return record ? toCatalogRecord(record) : null;
  }
}

type CatalogRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { memberships: number };
};

function toWhere(filter?: OrganizationCatalogFilter): Prisma.OrganizationWhereInput {
  const where: Prisma.OrganizationWhereInput = {};
  if (filter?.status) {
    where.status = filter.status;
  }
  const query = filter?.query?.trim();
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
    ];
  }
  return where;
}

function toCatalogRecord(record: CatalogRecord): OrganizationCatalogRecord {
  return {
    id: createOrganizationId(record.id),
    name: record.name,
    slug: record.slug,
    status: record.status === 'disabled' ? 'disabled' : 'active',
    memberCount: record._count.memberships,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
