import type { EmailAddress } from '../../domain/email-address.js';
import type { Invitation } from '../../domain/invitation.js';
import type { InvitationId } from '../../domain/invitation-id.js';
import type { OrganizationId } from '../../domain/organization-id.js';

export interface InvitationRepository {
  save(invitation: Invitation): Promise<void>;
  findById(tenantId: OrganizationId, invitationId: InvitationId): Promise<Invitation | null>;
  findPendingByEmail(tenantId: OrganizationId, email: EmailAddress): Promise<Invitation | null>;
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  listPendingByOrganization(tenantId: OrganizationId, now: Date): Promise<Invitation[]>;
}
