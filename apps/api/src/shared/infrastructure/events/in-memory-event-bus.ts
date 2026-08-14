import type { DomainEvent, EventBus, EventHandler } from '@ai-customer-support/shared';

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventName) ?? [];

    for (const handler of handlers) {
      await handler(event);
    }
  }

  subscribe(eventName: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(handler);
    this.handlers.set(eventName, existing);
  }
}
