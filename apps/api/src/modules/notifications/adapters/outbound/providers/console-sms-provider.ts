import type { Logger } from '@ai-customer-support/shared';
import type { NotificationProviderPort, ProviderMessage, ProviderResult } from '../../../application/ports.js';

export class ConsoleSmsProvider implements NotificationProviderPort {
  readonly name = 'sms_console' as const;
  readonly channel = 'sms' as const;

  constructor(
    private readonly logger: Logger,
    private readonly nodeEnv: string,
  ) {}

  async send(message: ProviderMessage): Promise<ProviderResult> {
    this.logger.info('Notification SMS (console provider)', {
      tenantId: message.tenantId,
      deliveryId: message.deliveryId,
      to: this.nodeEnv === 'production' ? undefined : message.recipient,
    });
    return { ok: true, provider: this.name, providerMessageId: message.deliveryId };
  }
}
