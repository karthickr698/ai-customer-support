import type { DomainEvent, EventBus, EventHandler, Logger } from '@ai-customer-support/shared';

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(private readonly logger?: Logger) {}

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventName) ?? [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown event handler error';
        this.logger?.error('Event handler failed', {
          eventType: event.eventName,
          eventId: event.eventId,
          message,
        });
      }
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }
}
