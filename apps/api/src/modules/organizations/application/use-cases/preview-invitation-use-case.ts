import type { InvitationPreviewDto } from '@ai-customer-support/contracts';
import { InvalidInvitationTokenError, OrganizationNotFoundError } from '../../domain/errors.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { InvitationRepository } from '../ports/invitation-repository.js';
import type { OrganizationRepository } from '../ports/organization-repository.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';

export class PreviewInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly tokenHasher: TokenHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(token: string): Promise<{ invitation: InvitationPreviewDto }> {
    const invitation = await this.invitations.findByTokenHash(this.tokenHasher.hash(token));
    if (!invitation) {
      throw new InvalidInvitationTokenError();
    }

    invitation.assertAcceptable(this.clock.now());

    const organization = await this.organizations.findById(invitation.organizationId);
    if (!organization) {
      throw new OrganizationNotFoundError();
    }

    organization.assertActive();

    return {
      invitation: {
        organizationName: organization.name,
        email: invitation.email.value,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };
  }
}
