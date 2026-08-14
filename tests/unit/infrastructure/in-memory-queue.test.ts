import { InfrastructureError } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import { InMemoryQueue } from '../../../apps/api/src/shared/infrastructure/messaging/in-memory-queue.ts';

describe('InMemoryQueue', () => {
  it('invokes registered processors when a job is enqueued', async () => {
    const queue = new InMemoryQueue();
    const processed: number[] = [];

    queue.process<number>('example', async (payload) => {
      processed.push(payload);
    });

    await queue.enqueue('example', 7);
    await queue.flush();

    expect(processed).toEqual([7]);
  });

  it('accepts jobs without waiting for the handler to finish', async () => {
    const queue = new InMemoryQueue();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let processed = false;

    queue.process('example', async () => {
      await gate;
      processed = true;
    });

    await queue.enqueue('example', { ok: true });
    expect(processed).toBe(false);

    release();
    await queue.flush();
    expect(processed).toBe(true);
  });

  it('rejects new jobs after close', async () => {
    const queue = new InMemoryQueue();
    await queue.close();

    await expect(queue.enqueue('example', 1)).rejects.toThrow(InfrastructureError);
  });
});
