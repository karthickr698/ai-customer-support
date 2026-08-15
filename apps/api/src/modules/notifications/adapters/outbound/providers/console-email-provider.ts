import type { Logger } from '@ai-customer-support/shared';
import type { NotificationProviderPort, ProviderMessage, ProviderResult } from '../../../application/ports.js';

export class ConsoleEmailProvider implements NotificationProviderPort {
  readonly name = 'console' as const;
  readonly channel = 'email' as const;

  constructor(
    private readonly logger: Logger,
    private readonly from: string,
    private readonly nodeEnv: string,
  ) {}

  async send(message: ProviderMessage): Promise<ProviderResult> {
    this.logger.info('Notification email (console provider)', {
      tenantId: message.tenantId,
      deliveryId: message.deliveryId,
      from: this.from,
      to: this.nodeEnv === 'production' ? undefined : message.recipient,
      subject: message.subject,
    });
    return { ok: true, provider: this.name, providerMessageId: message.deliveryId };
  }
}
