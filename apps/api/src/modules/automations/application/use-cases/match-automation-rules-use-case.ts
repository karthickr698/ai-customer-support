import type { DomainEvent, EventBus, Logger } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import { AutomationJob, eventIdempotencyKey } from '../../domain/automation-job.js';
import { conditionsMatch } from '../../domain/conditions.js';
import { AutomationJobEnqueuedEvent } from '../../domain/events.js';
import { AUTOMATION_EXECUTE_QUEUE, domainEventPayload, type AutomationExecuteJob } from '../queues.js';
import type { AutomationJobRepository, AutomationRuleRepository, ClockPort } from '../ports.js';

export class MatchAutomationRulesUseCase {
  constructor(
    private readonly rules: AutomationRuleRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!event.tenantId) {
      return;
    }
    const payload = domainEventPayload(event);
    const rules = await this.rules.listEnabledByEvent(event.tenantId, event.eventName);
    const now = this.clock.now();
    for (const rule of rules.sort((left, right) => left.priority - right.priority)) {
      if (!rule.matchesEvent(event.eventName) || !rule.belongsTo(event.tenantId)) {
        continue;
      }
      if (!conditionsMatch(rule.conditions, rule.match, payload)) {
        continue;
      }
      const job = AutomationJob.create({
        organizationId: event.tenantId,
        ruleId: rule.id,
        triggerKind: 'event',
        idempotencyKey: eventIdempotencyKey(event.tenantId, rule.id, event.eventId),
        now,
        maxAttempts: rule.maxAttempts,
        eventName: event.eventName,
        eventId: event.eventId,
        payload,
      });
      const created = await this.jobs.tryInsert(job);
      if (!created) {
        continue;
      }
      await this.queue.enqueue<AutomationExecuteJob>(AUTOMATION_EXECUTE_QUEUE, {
        tenantId: event.tenantId,
        jobId: job.id,
      });
      await this.eventBus.publish(
        new AutomationJobEnqueuedEvent(
          crypto.randomUUID(),
          now,
          event.tenantId,
          rule.id,
          job.id,
          'event',
          event.correlationId,
        ),
      );
      this.logger.info('Automation job enqueued', {
        tenantId: event.tenantId,
        ruleId: rule.id,
        jobId: job.id,
        eventName: event.eventName,
        eventId: event.eventId,
      });
    }
  }
}
