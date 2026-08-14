import type { Logger } from '@ai-customer-support/shared';
import type { AuthEmailMessage, EmailSenderPort } from '../../../application/ports/email-sender-port.js';

export class ConsoleEmailSender implements EmailSenderPort {
  constructor(
    private readonly logger: Logger,
    private readonly nodeEnv: string,
  ) {}

  async send(message: AuthEmailMessage): Promise<void> {
    if (this.nodeEnv === 'production') {
      this.logger.info('Auth email dispatched via console adapter', { kind: message.kind });
      return;
    }

    const url = message.kind === 'email_verification' ? message.verifyUrl : message.resetUrl;
    this.logger.info('Auth email (development console)', {
      kind: message.kind,
      to: message.to,
      url,
    });
  }
}
