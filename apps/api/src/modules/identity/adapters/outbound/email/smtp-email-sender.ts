import { InfrastructureError, type Logger } from '@ai-customer-support/shared';
import nodemailer from 'nodemailer';
import type { AuthEmailMessage, EmailSenderPort } from '../../../application/ports/email-sender-port.js';

export class SmtpEmailSender implements EmailSenderPort {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
    private readonly logger: Logger,
  ) {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }

  async send(message: AuthEmailMessage): Promise<void> {
    const { subject, text } = render(message);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject,
        text,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'SMTP send failed';
      this.logger.error('Failed to send auth email', { kind: message.kind, message: reason });
      throw new InfrastructureError('Unable to send email right now');
    }
  }
}

function render(message: AuthEmailMessage): { subject: string; text: string } {
  if (message.kind === 'email_verification') {
    return {
      subject: 'Verify your email',
      text: `Verify your email address by opening this link:\n${message.verifyUrl}\n`,
    };
  }

  return {
    subject: 'Reset your password',
    text: `Reset your password by opening this link:\n${message.resetUrl}\nIf you did not request this, you can ignore this email.\n`,
  };
}
