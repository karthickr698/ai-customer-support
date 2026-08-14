import type { Organization } from '../../domain/organization.js';
import type { OrganizationId } from '../../domain/organization-id.js';
import type { OrganizationSlug } from '../../domain/organization-slug.js';

export interface OrganizationRepository {
  findById(id: OrganizationId): Promise<Organization | null>;
  findBySlug(slug: OrganizationSlug): Promise<Organization | null>;
  findByIds(ids: readonly OrganizationId[]): Promise<Organization[]>;
  save(organization: Organization): Promise<void>;
}
