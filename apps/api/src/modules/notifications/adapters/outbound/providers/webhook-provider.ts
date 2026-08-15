import { NotificationProviderError } from '../../../domain/errors.js';
import type { NotificationProviderPort, ProviderMessage, ProviderResult } from '../../../application/ports.js';

export class WebhookNotificationProvider implements NotificationProviderPort {
  readonly name = 'webhook' as const;
  readonly channel = 'webhook' as const;

  constructor(
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: ProviderMessage): Promise<ProviderResult> {
    try {
      const response = await this.fetchImpl(message.recipient, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-notification-delivery-id': message.deliveryId,
          'x-tenant-id': message.tenantId,
        },
        body: JSON.stringify({
          deliveryId: message.deliveryId,
          eventType: message.eventType,
          subject: message.subject ?? null,
          body: message.body,
          data: message.payload,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status < 200 || response.status >= 300) {
        return {
          ok: false,
          provider: this.name,
          error: `Webhook returned status ${response.status}`,
        };
      }
      return { ok: true, provider: this.name, providerMessageId: message.deliveryId };
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new NotificationProviderError('Webhook delivery timed out');
      }
      const reason = error instanceof Error ? error.message : 'Webhook delivery failed';
      throw new NotificationProviderError(reason);
    }
  }
}
