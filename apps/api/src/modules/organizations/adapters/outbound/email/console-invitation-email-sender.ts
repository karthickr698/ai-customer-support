import type { Logger } from '@ai-customer-support/shared';
import type {
  InvitationEmailMessage,
  InvitationEmailPort,
} from '../../../application/ports/invitation-email-port.js';

export class ConsoleInvitationEmailSender implements InvitationEmailPort {
  constructor(
    private readonly logger: Logger,
    private readonly nodeEnv: string,
  ) {}

  async sendInvitation(message: InvitationEmailMessage): Promise<void> {
    if (this.nodeEnv === 'production') {
      this.logger.info('Invitation email dispatched via console adapter', { kind: 'organization_invitation' });
      return;
    }

    this.logger.info('Invitation email (development console)', {
      kind: 'organization_invitation',
      to: message.to,
      organizationName: message.organizationName,
      url: message.acceptUrl,
    });
  }
}
