import type { DomainEvent } from './domain-event.js';

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
}

export type EventBusPort = EventBus;
