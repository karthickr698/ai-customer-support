import { InMemoryEventBus } from '../../../apps/api/src/shared/infrastructure/events/in-memory-event-bus.ts';
import { describe, expect, it } from 'vitest';

describe('InMemoryEventBus', () => {
  it('delivers published events to subscribers', async () => {
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
});
