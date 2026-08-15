import { InfrastructureError, type Logger } from '@ai-customer-support/shared';
import nodemailer from 'nodemailer';
import type { NotificationProviderPort, ProviderMessage, ProviderResult } from '../../../application/ports.js';

export class SmtpEmailProvider implements NotificationProviderPort {
  readonly name = 'smtp' as const;
  readonly channel = 'email' as const;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
    private readonly logger: Logger,
  ) {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }

  async send(message: ProviderMessage): Promise<ProviderResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: message.recipient,
        subject: message.subject ?? 'Notification',
        text: message.body,
      });
      return {
        ok: true,
        provider: this.name,
        providerMessageId: typeof info.messageId === 'string' ? info.messageId : message.deliveryId,
      };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'SMTP send failed';
      this.logger.error('Failed to send notification email', {
        tenantId: message.tenantId,
        deliveryId: message.deliveryId,
        message: reason,
      });
      throw new InfrastructureError('Unable to send email right now');
    }
  }
}
