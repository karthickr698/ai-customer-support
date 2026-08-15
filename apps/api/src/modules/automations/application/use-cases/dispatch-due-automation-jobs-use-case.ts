import type { Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { DISPATCH_BATCH_SIZE, STALE_RUNNING_MS } from '../../domain/automation-policy.js';
import { AUTOMATION_EXECUTE_QUEUE, type AutomationExecuteJob } from '../queues.js';
import type { AutomationJobRepository, ClockPort } from '../ports.js';

export class DispatchDueAutomationJobsUseCase {
  constructor(
    private readonly jobs: AutomationJobRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly logger: Logger,
  ) {}

  async execute(limit = DISPATCH_BATCH_SIZE): Promise<number> {
    const now = this.clock.now();
    const due = await this.jobs.listDue(now, limit);
    const stale = await this.jobs.reclaimStale(now, STALE_RUNNING_MS, limit);
    const batch = [...due, ...stale];
    let enqueued = 0;
    const seen = new Set<string>();
    for (const job of batch) {
      if (seen.has(job.id) || job.isTerminal()) {
        continue;
      }
      seen.add(job.id);
      await this.queue.enqueue<AutomationExecuteJob>(AUTOMATION_EXECUTE_QUEUE, {
        tenantId: job.organizationId,
        jobId: job.id,
      });
      enqueued += 1;
    }
    if (enqueued > 0) {
      this.logger.info('Dispatched due automation jobs', { enqueued });
    }
    return enqueued;
  }
}
