import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { OrganizationId } from '../../domain/organization-id.js';
import type { OrganizationStatus } from '../../domain/organization.js';

export type OrganizationCatalogRecord = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly memberCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type OrganizationCatalogFilter = {
  readonly status?: OrganizationStatus;
  readonly query?: string;
};

export interface OrganizationCatalogPort {
  list(page: PageRequest, filter?: OrganizationCatalogFilter): Promise<Page<OrganizationCatalogRecord>>;
  findSummary(id: OrganizationId): Promise<OrganizationCatalogRecord | null>;
}
