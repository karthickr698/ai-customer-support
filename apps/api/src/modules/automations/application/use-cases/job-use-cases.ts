import type { EventBus } from '@ai-customer-support/shared';
import type { QueuePort } from '../../../../shared/application/ports/queue-port.js';
import type {
  AutomationExecutionLogListResponse,
  AutomationJobListResponse,
  AutomationJobResponse,
  DispatchAutomationsResponse,
  RunAutomationResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AutomationJob, manualIdempotencyKey } from '../../domain/automation-job.js';
import { AutomationPolicy } from '../../domain/automation-policy.js';
import { AutomationJobEnqueuedEvent } from '../../domain/events.js';
import { AutomationJobNotFoundError, InvalidAutomationError } from '../../domain/errors.js';
import { createAutomationJobId, createAutomationRuleId } from '../../domain/ids.js';
import { isUuid, parseJobStatus } from '../../domain/values.js';
import { toJobDto, toLogDto, type RequestSecurityContext } from '../dtos.js';
import { AUTOMATION_EXECUTE_QUEUE, type AutomationExecuteJob } from '../queues.js';
import type {
  AutomationExecutionLogRepository,
  AutomationJobRepository,
  AutomationRuleRepository,
  ClockPort,
  TenantAccessPort,
} from '../ports.js';
import { DispatchDueAutomationJobsUseCase } from './dispatch-due-automation-jobs-use-case.js';
import { EnqueueScheduledAutomationsUseCase } from './enqueue-scheduled-automations-use-case.js';
import { loadRule } from './rule-use-cases.js';

export class RunAutomationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: AutomationRuleRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly ruleId: string;
    readonly idempotencyKey?: string;
    readonly payload?: Record<string, unknown>;
    readonly security: RequestSecurityContext;
  }): Promise<RunAutomationResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const rule = await loadRule(this.rules, actor.tenantId, input.ruleId);
    const now = this.clock.now();
    const key = (input.idempotencyKey?.trim() || input.security.requestId).slice(0, 80);
    const payload = {
      trigger: 'manual',
      actorId: actor.actorId,
      ...(input.payload ?? {}),
    };
    const job = AutomationJob.create({
      organizationId: actor.tenantId,
      ruleId: rule.id,
      triggerKind: 'manual',
      idempotencyKey: manualIdempotencyKey(actor.tenantId, rule.id, key),
      now,
      maxAttempts: rule.maxAttempts,
      payload,
    });
    const created = await this.jobs.tryInsert(job);
    const stored = created ? job : await this.jobs.findByIdempotencyKey(job.idempotencyKey);
    if (!stored || !stored.belongsTo(actor.tenantId)) {
      throw new AutomationJobNotFoundError();
    }
    if (created) {
      await this.queue.enqueue<AutomationExecuteJob>(AUTOMATION_EXECUTE_QUEUE, {
        tenantId: actor.tenantId,
        jobId: stored.id,
      });
      await this.eventBus.publish(
        new AutomationJobEnqueuedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          rule.id,
          stored.id,
          'manual',
          input.security.correlationId,
        ),
      );
    }
    return { job: toJobDto(stored), created };
  }
}

export class RetryAutomationJobUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly jobs: AutomationJobRepository,
    private readonly queue: QueuePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly jobId: string;
  }): Promise<AutomationJobResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const job = await loadJob(this.jobs, actor.tenantId, input.jobId);
    job.scheduleRetry(this.clock.now());
    await this.jobs.save(job);
    await this.queue.enqueue<AutomationExecuteJob>(AUTOMATION_EXECUTE_QUEUE, {
      tenantId: actor.tenantId,
      jobId: job.id,
    });
    return { job: toJobDto(job) };
  }
}

export class GetAutomationJobUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly jobs: AutomationJobRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly jobId: string;
  }): Promise<AutomationJobResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_READ);
    const job = await loadJob(this.jobs, actor.tenantId, input.jobId);
    return { job: toJobDto(job) };
  }
}

export class ListAutomationJobsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly jobs: AutomationJobRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly ruleId?: string;
    readonly status?: string;
  }): Promise<AutomationJobListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_READ);
    if (input.ruleId && !isUuid(input.ruleId)) {
      throw new InvalidAutomationError('ruleId must be a UUID');
    }
    const result = await this.jobs.listByTenant(actor.tenantId, input.page, {
      ruleId: input.ruleId ? createAutomationRuleId(input.ruleId) : undefined,
      status: input.status ? parseJobStatus(input.status) : undefined,
    });
    return {
      items: result.items.filter((job) => job.belongsTo(actor.tenantId)).map(toJobDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class ListAutomationLogsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly logs: AutomationExecutionLogRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly ruleId?: string;
    readonly jobId?: string;
    readonly status?: string;
  }): Promise<AutomationExecutionLogListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_READ);
    if (input.ruleId && !isUuid(input.ruleId)) {
      throw new InvalidAutomationError('ruleId must be a UUID');
    }
    if (input.jobId && !isUuid(input.jobId)) {
      throw new InvalidAutomationError('jobId must be a UUID');
    }
    const result = await this.logs.listByTenant(actor.tenantId, input.page, {
      ruleId: input.ruleId ? createAutomationRuleId(input.ruleId) : undefined,
      jobId: input.jobId ? createAutomationJobId(input.jobId) : undefined,
      status: input.status,
    });
    return {
      items: result.items.map(toLogDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class DispatchAutomationsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly enqueueScheduled: EnqueueScheduledAutomationsUseCase,
    private readonly dispatchDue: DispatchDueAutomationJobsUseCase,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<DispatchAutomationsResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AutomationPolicy.assertPermission(actor.permissions, Permissions.AUTOMATION_MANAGE);
    const scheduled = await this.enqueueScheduled.execute();
    const enqueued = await this.dispatchDue.execute();
    return { enqueued, scheduled };
  }
}

async function loadJob(
  jobs: AutomationJobRepository,
  tenantId: string,
  jobId: string,
): Promise<AutomationJob> {
  if (!isUuid(jobId)) {
    throw new InvalidAutomationError('jobId must be a UUID');
  }
  const job = await jobs.findById(tenantId, createAutomationJobId(jobId));
  if (!job || !job.belongsTo(tenantId)) {
    throw new AutomationJobNotFoundError();
  }
  return job;
}
