import type { QueuePort } from '../../application/ports/queue-port.js';

type JobHandler = (payload: unknown) => Promise<void>;

export class InMemoryQueue implements QueuePort {
  private readonly handlers = new Map<string, JobHandler[]>();
  private closed = false;

  async enqueue<T>(queueName: string, payload: T): Promise<void> {
    if (this.closed) {
      throw new Error(`Queue is closed; cannot enqueue to "${queueName}"`);
    }

    const handlers = this.handlers.get(queueName) ?? [];

    for (const handler of handlers) {
      await handler(payload);
    }
  }

  process<T>(queueName: string, handler: (payload: T) => Promise<void>): void {
    const existing = this.handlers.get(queueName) ?? [];
    existing.push(handler as JobHandler);
    this.handlers.set(queueName, existing);
  }

  close(): void {
    this.closed = true;
    this.handlers.clear();
  }
}
