import { InfrastructureError, type Logger } from '@ai-customer-support/shared';
import nodemailer from 'nodemailer';
import type {
  InvitationEmailMessage,
  InvitationEmailPort,
} from '../../../application/ports/invitation-email-port.js';

export class SmtpInvitationEmailSender implements InvitationEmailPort {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
    private readonly logger: Logger,
  ) {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }

  async sendInvitation(message: InvitationEmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: `Join ${message.organizationName}`,
        text: [
          `You were invited to join ${message.organizationName} as ${message.role}.`,
          `Accept the invitation by opening this link:\n${message.acceptUrl}`,
          'If you were not expecting this, you can ignore the email.',
        ].join('\n\n'),
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'SMTP send failed';
      this.logger.error('Failed to send invitation email', { message: reason });
      throw new InfrastructureError('Unable to send email right now');
    }
  }
}
