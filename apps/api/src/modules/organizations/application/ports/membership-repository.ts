import type { Membership } from '../../domain/membership.js';
import type { MembershipId } from '../../domain/membership-id.js';
import type { OrganizationId } from '../../domain/organization-id.js';

export interface MembershipRepository {
  save(membership: Membership): Promise<void>;
  findById(tenantId: OrganizationId, membershipId: MembershipId): Promise<Membership | null>;
  findByUser(tenantId: OrganizationId, userId: string): Promise<Membership | null>;
  listByOrganization(tenantId: OrganizationId): Promise<Membership[]>;
  listByUser(userId: string): Promise<Membership[]>;
  countActiveOwners(tenantId: OrganizationId): Promise<number>;
  delete(tenantId: OrganizationId, membershipId: MembershipId): Promise<void>;
}
