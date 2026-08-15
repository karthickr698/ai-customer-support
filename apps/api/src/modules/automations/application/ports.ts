import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { AutomationJobStatus } from '@ai-customer-support/contracts';
import type { AutomationExecutionLog } from '../domain/automation-execution-log.js';
import type { AutomationJob } from '../domain/automation-job.js';
import type { AutomationRule } from '../domain/automation-rule.js';
import type {
  AutomationExecutionLogId,
  AutomationJobId,
  AutomationRuleId,
} from '../domain/ids.js';

export type AutomationActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<AutomationActor>;
}

export interface ClockPort {
  now(): Date;
}

export type AutomationHttpRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: Record<string, unknown>;
  readonly timeoutMs: number;
};

export type AutomationHttpResult = {
  readonly status: number;
  readonly data: Record<string, unknown>;
};

export interface AutomationHttpPort {
  request(input: AutomationHttpRequest): Promise<AutomationHttpResult>;
}

export interface AutomationRuleRepository {
  save(rule: AutomationRule): Promise<void>;
  findById(tenantId: string, ruleId: AutomationRuleId): Promise<AutomationRule | null>;
  listByTenant(tenantId: string): Promise<AutomationRule[]>;
  listEnabledByEvent(tenantId: string, eventName: string): Promise<AutomationRule[]>;
  listDueSchedules(now: Date, limit: number): Promise<AutomationRule[]>;
  delete(tenantId: string, ruleId: AutomationRuleId): Promise<void>;
  countByTenant(tenantId: string): Promise<number>;
}

export type AutomationJobListFilter = {
  readonly ruleId?: AutomationRuleId;
  readonly status?: AutomationJobStatus;
};

export interface AutomationJobRepository {
  save(job: AutomationJob): Promise<void>;
  tryInsert(job: AutomationJob): Promise<boolean>;
  findById(tenantId: string, jobId: AutomationJobId): Promise<AutomationJob | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<AutomationJob | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: AutomationJobListFilter,
  ): Promise<Page<AutomationJob>>;
  claim(tenantId: string, jobId: AutomationJobId, now: Date): Promise<AutomationJob | null>;
  listDue(now: Date, limit: number): Promise<AutomationJob[]>;
  reclaimStale(now: Date, staleAfterMs: number, limit: number): Promise<AutomationJob[]>;
}

export type AutomationLogListFilter = {
  readonly ruleId?: AutomationRuleId;
  readonly jobId?: AutomationJobId;
  readonly status?: string;
};

export interface AutomationExecutionLogRepository {
  save(log: AutomationExecutionLog): Promise<void>;
  findById(tenantId: string, logId: AutomationExecutionLogId): Promise<AutomationExecutionLog | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: AutomationLogListFilter,
  ): Promise<Page<AutomationExecutionLog>>;
}
