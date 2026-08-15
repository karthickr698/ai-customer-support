import type { NotificationChannel } from '@ai-customer-support/contracts';
import { InvalidNotificationError } from '../../../domain/errors.js';
import type {
  NotificationProviderPort,
  NotificationProviderRegistry,
} from '../../../application/ports.js';

export class ChannelNotificationProviderRegistry implements NotificationProviderRegistry {
  private readonly providers = new Map<NotificationChannel, NotificationProviderPort>();

  register(provider: NotificationProviderPort): this {
    this.providers.set(provider.channel, provider);
    return this;
  }

  resolve(channel: NotificationChannel): NotificationProviderPort {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new InvalidNotificationError(`No notification provider is configured for ${channel}`);
    }
    return provider;
  }
}
