import type {
  AutomationExecutionLogDto,
  AutomationJobDto,
  AutomationRuleDto,
} from '@ai-customer-support/contracts';
import { actionToConfig } from '../domain/action.js';
import type { AutomationExecutionLog } from '../domain/automation-execution-log.js';
import type { AutomationJob } from '../domain/automation-job.js';
import type { AutomationRule } from '../domain/automation-rule.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toRuleDto(rule: AutomationRule): AutomationRuleDto {
  const snapshot = rule.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    description: snapshot.description ?? null,
    enabled: snapshot.enabled,
    triggerType: snapshot.triggerType,
    eventName: snapshot.eventName ?? null,
    schedule: snapshot.schedule ?? null,
    match: snapshot.match,
    conditions: snapshot.conditions,
    actionType: snapshot.actionType,
    action: actionToConfig(rule.action),
    maxAttempts: snapshot.maxAttempts,
    backoffMs: snapshot.backoffMs,
    priority: snapshot.priority,
    nextRunAt: snapshot.nextRunAt?.toISOString() ?? null,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toJobDto(job: AutomationJob): AutomationJobDto {
  const snapshot = job.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    ruleId: snapshot.ruleId,
    triggerKind: snapshot.triggerKind,
    idempotencyKey: snapshot.idempotencyKey,
    eventName: snapshot.eventName ?? null,
    eventId: snapshot.eventId ?? null,
    payload: snapshot.payload,
    status: snapshot.status,
    attempt: snapshot.attempt,
    maxAttempts: snapshot.maxAttempts,
    runAfter: snapshot.runAfter.toISOString(),
    lastError: snapshot.lastError ?? null,
    claimedAt: snapshot.claimedAt?.toISOString() ?? null,
    completedAt: snapshot.completedAt?.toISOString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toLogDto(log: AutomationExecutionLog): AutomationExecutionLogDto {
  const snapshot = log.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    jobId: snapshot.jobId,
    ruleId: snapshot.ruleId,
    attempt: snapshot.attempt,
    status: snapshot.status,
    message: snapshot.message ?? null,
    input: snapshot.input ?? null,
    output: snapshot.output ?? null,
    startedAt: snapshot.startedAt.toISOString(),
    finishedAt: snapshot.finishedAt?.toISOString() ?? null,
  };
}
