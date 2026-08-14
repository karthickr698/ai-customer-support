import { InfrastructureError, type Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../application/ports/queue-port.js';

type JobHandler = (payload: unknown) => Promise<void>;

interface PendingJob {
  readonly queueName: string;
  readonly payload: unknown;
}

export class InMemoryQueue implements QueuePort {
  private readonly handlers = new Map<string, JobHandler[]>();
  private closed = false;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly logger?: Logger) {}

  async enqueue<T>(queueName: string, payload: T): Promise<void> {
    if (this.closed) {
      throw new InfrastructureError(`Queue is closed; cannot enqueue to "${queueName}"`);
    }

    const job: PendingJob = { queueName, payload };
    this.chain = this.chain.then(() => this.run(job));
  }

  process<T>(queueName: string, handler: (payload: T) => Promise<void>): void {
    const existing = this.handlers.get(queueName) ?? [];
    existing.push(handler as JobHandler);
    this.handlers.set(queueName, existing);
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.flush();
    this.handlers.clear();
  }

  async flush(): Promise<void> {
    await this.chain;
  }

  private async run(job: PendingJob): Promise<void> {
    const handlers = this.handlers.get(job.queueName) ?? [];

    for (const handler of handlers) {
      try {
        await handler(job.payload);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown queue handler error';
        this.logger?.error('Queue handler failed', {
          queueName: job.queueName,
          message,
        });
      }
    }
  }
}
