import type { KnowledgeSourceStatus } from '@ai-customer-support/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { KnowledgeSourceRepository } from '../../../application/ports/knowledge-source-repository.js';
import { KnowledgeSource, type KnowledgeSourceSnapshot } from '../../../domain/knowledge-source.js';
import { createKnowledgeSourceId, type KnowledgeSourceId } from '../../../domain/knowledge-source-id.js';
import { parseKnowledgeSourceType } from '../../../domain/knowledge-source-type.js';

type KnowledgeSourceRecord = {
  id: string;
  organizationId: string;
  type: string;
  name: string;
  url: string | null;
  description: string | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresKnowledgeSourceRepository implements KnowledgeSourceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, sourceId: KnowledgeSourceId): Promise<KnowledgeSource | null> {
    const record = await this.prisma.knowledgeSource.findFirst({
      where: { id: sourceId, organizationId: tenantId },
    });
    return record ? toSource(record) : null;
  }

  async save(source: KnowledgeSource): Promise<void> {
    const snapshot = source.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.knowledgeSource.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        type: data.type,
        name: data.name,
        url: data.url,
        description: data.description,
        status: data.status,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(tenantId: string, sourceId: KnowledgeSourceId): Promise<void> {
    await this.prisma.knowledgeSource.deleteMany({
      where: { id: sourceId, organizationId: tenantId },
    });
  }

  async listByTenant(tenantId: string): Promise<KnowledgeSource[]> {
    const records = await this.prisma.knowledgeSource.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toSource);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.knowledgeSource.count({ where: { organizationId: tenantId } });
  }
}

function toSource(record: KnowledgeSourceRecord): KnowledgeSource {
  const snapshot: KnowledgeSourceSnapshot = {
    id: createKnowledgeSourceId(record.id),
    organizationId: record.organizationId,
    type: parseKnowledgeSourceType(record.type),
    name: record.name,
    url: record.url ?? undefined,
    description: record.description ?? undefined,
    status: record.status as KnowledgeSourceStatus,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return KnowledgeSource.reconstitute(snapshot);
}

function toRecord(snapshot: KnowledgeSourceSnapshot): Prisma.KnowledgeSourceUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    type: snapshot.type,
    name: snapshot.name,
    url: snapshot.url ?? null,
    description: snapshot.description ?? null,
    status: snapshot.status,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
