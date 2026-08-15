import { DomainError, type Page, type PageRequest } from '@ai-customer-support/shared';
import type { OrganizationAdminQuery } from '../../../../organizations/index.js';
import { PlatformTenantNotFoundError } from '../../../domain/errors.js';
import type {
  TenantDirectoryPort,
  TenantListFilter,
  TenantRecord,
} from '../../../application/ports.js';

export class OrganizationsTenantDirectoryAdapter implements TenantDirectoryPort {
  constructor(private readonly admin: OrganizationAdminQuery) {}

  async list(page: PageRequest, filter?: TenantListFilter): Promise<Page<TenantRecord>> {
    const result = await this.admin.list(page, filter);
    return {
      ...result,
      items: result.items.map(toTenantRecord),
    };
  }

  async findById(organizationId: string): Promise<TenantRecord | null> {
    const record = await this.admin.get(organizationId);
    return record ? toTenantRecord(record) : null;
  }

  async setStatus(
    organizationId: string,
    status: 'active' | 'disabled',
    now: Date,
    correlationId?: string,
  ): Promise<TenantRecord> {
    try {
      const record = await this.admin.setStatus({ organizationId, status, now, correlationId });
      return toTenantRecord(record);
    } catch (error: unknown) {
      if (error instanceof DomainError && error.code === 'ORGANIZATION_NOT_FOUND') {
        throw new PlatformTenantNotFoundError();
      }
      throw error;
    }
  }
}

function toTenantRecord(record: {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: 'active' | 'disabled';
  readonly memberCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TenantRecord {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    memberCount: record.memberCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
