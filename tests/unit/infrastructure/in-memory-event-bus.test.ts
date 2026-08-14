import { InMemoryEventBus } from '../../../apps/api/src/shared/infrastructure/events/in-memory-event-bus.ts';
import { describe, expect, it } from 'vitest';

describe('InMemoryEventBus', () => {
  it('delivers published events to subscribers of that event type', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe('example.occurred', async (event) => {
      received.push(event.eventName);
    });

    await bus.publish({
      eventId: 'evt_1',
      eventName: 'example.occurred',
      occurredAt: new Date(),
    });

    expect(received).toEqual(['example.occurred']);
  });

  it('does not deliver events to subscribers of a different type', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe('other.occurred', async (event) => {
      received.push(event.eventName);
    });

    await bus.publish({
      eventId: 'evt_2',
      eventName: 'example.occurred',
      occurredAt: new Date(),
    });

    expect(received).toEqual([]);
  });

  it('continues notifying remaining handlers when one fails', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe('example.occurred', async () => {
      throw new Error('handler failed');
    });
    bus.subscribe('example.occurred', async (event) => {
      received.push(event.eventId);
    });

    await bus.publish({
      eventId: 'evt_3',
      eventName: 'example.occurred',
      occurredAt: new Date(),
    });

    expect(received).toEqual(['evt_3']);
  });
});
