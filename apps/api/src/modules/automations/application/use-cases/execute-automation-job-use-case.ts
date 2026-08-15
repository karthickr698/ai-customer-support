import type { EventBus, Logger } from '@ai-customer-support/shared';
import { AutomationActionFailedError } from '../../domain/errors.js';
import { AutomationExecutionLog } from '../../domain/automation-execution-log.js';
import { conditionsMatch } from '../../domain/conditions.js';
import {
  AutomationActionExecutedEvent,
  AutomationJobFailedEvent,
  AutomationJobSucceededEvent,
} from '../../domain/events.js';
import { createAutomationJobId } from '../../domain/ids.js';
import { isUuid } from '../../domain/values.js';
import type { AutomationExecuteJob } from '../queues.js';
import type {
  AutomationExecutionLogRepository,
  AutomationHttpPort,
  AutomationJobRepository,
  AutomationRuleRepository,
  ClockPort,
} from '../ports.js';

export class ExecuteAutomationJobUseCase {
  constructor(
    private readonly rules: AutomationRuleRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly logs: AutomationExecutionLogRepository,
    private readonly http: AutomationHttpPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async execute(message: AutomationExecuteJob): Promise<void> {
    if (!isUuid(message.jobId) || !message.tenantId) {
      return;
    }
    const claimed = await this.jobs.claim(message.tenantId, createAutomationJobId(message.jobId), this.clock.now());
    if (!claimed) {
      return;
    }
    const rule = await this.rules.findById(claimed.organizationId, claimed.ruleId);
    const startedAt = this.clock.now();
    const log = AutomationExecutionLog.start({
      organizationId: claimed.organizationId,
      jobId: claimed.id,
      ruleId: claimed.ruleId,
      attempt: claimed.attempt,
      now: startedAt,
      payload: claimed.payload,
    });
    await this.logs.save(log);

    if (!rule || !rule.belongsTo(claimed.organizationId) || !rule.enabled) {
      const now = this.clock.now();
      claimed.markSkipped(now, 'Rule is missing or disabled');
      log.finish('skipped', now, claimed.lastError);
      await this.jobs.save(claimed);
      await this.logs.save(log);
      return;
    }

    if (!conditionsMatch(rule.conditions, rule.match, claimed.payload)) {
      const now = this.clock.now();
      claimed.markSkipped(now, 'Conditions no longer match');
      log.finish('skipped', now, claimed.lastError);
      await this.jobs.save(claimed);
      await this.logs.save(log);
      return;
    }

    try {
      const output = await this.runAction(claimed.organizationId, rule.id, claimed.id, rule.action, claimed.payload);
      const now = this.clock.now();
      claimed.markSucceeded(now);
      log.finish('succeeded', now, typeof output.message === 'string' ? output.message : undefined, output);
      await this.jobs.save(claimed);
      await this.logs.save(log);
      await this.eventBus.publish(
        new AutomationJobSucceededEvent(
          crypto.randomUUID(),
          now,
          claimed.organizationId,
          claimed.ruleId,
          claimed.id,
          claimed.attempt,
        ),
      );
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : 'Automation action failed';
      const now = this.clock.now();
      claimed.markFailed({ now, error: messageText, backoffMs: rule.backoffMs });
      log.finish('failed', now, messageText);
      await this.jobs.save(claimed);
      await this.logs.save(log);
      await this.eventBus.publish(
        new AutomationJobFailedEvent(
          crypto.randomUUID(),
          now,
          claimed.organizationId,
          claimed.ruleId,
          claimed.id,
          claimed.attempt,
          claimed.status === 'dead',
        ),
      );
      this.logger.warn('Automation job failed', {
        tenantId: claimed.organizationId,
        ruleId: claimed.ruleId,
        jobId: claimed.id,
        attempt: claimed.attempt,
        status: claimed.status,
        message: messageText,
      });
    }
  }

  private async runAction(
    tenantId: string,
    ruleId: string,
    jobId: string,
    action: import('../../domain/action.js').AutomationAction,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (action.type === 'record') {
      return { recorded: true, message: action.message ?? 'recorded' };
    }
    if (action.type === 'emit_event') {
      const data = { ...action.data, sourceEvent: payload.eventName ?? null };
      await this.eventBus.publish(
        new AutomationActionExecutedEvent(
          crypto.randomUUID(),
          this.clock.now(),
          tenantId,
          ruleId,
          jobId,
          action.type,
          data,
        ),
      );
      return { emitted: true, data };
    }
    const result = await this.http.request({
      url: action.url,
      method: action.method,
      headers: {
        'content-type': 'application/json',
        'x-automation-rule-id': ruleId,
        'x-automation-job-id': jobId,
        ...action.headers,
      },
      body: Object.keys(action.body).length > 0 ? action.body : payload,
      timeoutMs: action.timeoutMs,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new AutomationActionFailedError(`HTTP action returned status ${result.status}`);
    }
    await this.eventBus.publish(
      new AutomationActionExecutedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        tenantId,
        ruleId,
        jobId,
        action.type,
        { status: result.status },
      ),
    );
    return { status: result.status, data: result.data };
  }
}
