import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { AutomationJob, scheduleIdempotencyKey } from '../../domain/automation-job.js';
import { AutomationJobEnqueuedEvent } from '../../domain/events.js';
import { AUTOMATION_EXECUTE_QUEUE, type AutomationExecuteJob } from '../queues.js';
import type { AutomationJobRepository, AutomationRuleRepository, ClockPort } from '../ports.js';

export class EnqueueScheduledAutomationsUseCase {
  constructor(
    private readonly rules: AutomationRuleRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async execute(limit = 50): Promise<number> {
    const now = this.clock.now();
    const due = await this.rules.listDueSchedules(now, limit);
    let scheduled = 0;
    for (const rule of due) {
      if (!rule.isDue(now)) {
        continue;
      }
      const slot = rule.nextRunAt ?? now;
      const payload = {
        trigger: 'schedule',
        schedule: rule.scheduleExpression,
        slot: slot.toISOString(),
        scheduledAt: now.toISOString(),
      };
      const job = AutomationJob.create({
        organizationId: rule.organizationId,
        ruleId: rule.id,
        triggerKind: 'schedule',
        idempotencyKey: scheduleIdempotencyKey(rule.organizationId, rule.id, slot),
        now,
        maxAttempts: rule.maxAttempts,
        payload,
      });
      const created = await this.jobs.tryInsert(job);
      rule.advanceSchedule(now);
      await this.rules.save(rule);
      if (!created) {
        continue;
      }
      await this.queue.enqueue<AutomationExecuteJob>(AUTOMATION_EXECUTE_QUEUE, {
        tenantId: rule.organizationId,
        jobId: job.id,
      });
      await this.eventBus.publish(
        new AutomationJobEnqueuedEvent(
          crypto.randomUUID(),
          now,
          rule.organizationId,
          rule.id,
          job.id,
          'schedule',
        ),
      );
      scheduled += 1;
      this.logger.info('Scheduled automation job enqueued', {
        tenantId: rule.organizationId,
        ruleId: rule.id,
        jobId: job.id,
      });
    }
    return scheduled;
  }
}
