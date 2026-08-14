import { InMemoryQueue } from '../../../apps/api/src/shared/infrastructure/messaging/in-memory-queue.ts';
import { describe, expect, it } from 'vitest';

describe('InMemoryQueue', () => {
  it('invokes registered processors when a job is enqueued', async () => {
    const queue = new InMemoryQueue();
    const processed: number[] = [];

    queue.process<number>('example', async (payload) => {
      processed.push(payload);
    });

    await queue.enqueue('example', 7);

    expect(processed).toEqual([7]);
  });
});
