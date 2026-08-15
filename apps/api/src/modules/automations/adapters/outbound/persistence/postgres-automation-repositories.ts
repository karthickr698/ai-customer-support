import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { parseConditions } from '../../../domain/conditions.js';
import { AutomationExecutionLog, type AutomationExecutionLogSnapshot } from '../../../domain/automation-execution-log.js';
import { AutomationJob, asTriggerKind, payloadRecord, type AutomationJobSnapshot } from '../../../domain/automation-job.js';
import { AutomationRule, type AutomationRuleSnapshot } from '../../../domain/automation-rule.js';
import {
  createAutomationExecutionLogId,
  createAutomationJobId,
  createAutomationRuleId,
  type AutomationExecutionLogId,
  type AutomationJobId,
  type AutomationRuleId,
} from '../../../domain/ids.js';
import { jsonRecord, parseActionType, parseJobStatus, parseMatchMode, parseTriggerType } from '../../../domain/values.js';
import type {
  AutomationExecutionLogRepository,
  AutomationJobListFilter,
  AutomationJobRepository,
  AutomationLogListFilter,
  AutomationRuleRepository,
} from '../../../application/ports.js';

export class PostgresAutomationRuleRepository implements AutomationRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(rule: AutomationRule): Promise<void> {
    const snapshot = rule.toSnapshot();
    const data = toRuleRecord(snapshot);
    await this.prisma.automationRule.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        triggerType: data.triggerType,
        eventName: data.eventName,
        schedule: data.schedule,
        matchMode: data.matchMode,
        conditions: data.conditions,
        actionType: data.actionType,
        actionConfig: data.actionConfig,
        maxAttempts: data.maxAttempts,
        backoffMs: data.backoffMs,
        priority: data.priority,
        nextRunAt: data.nextRunAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, ruleId: AutomationRuleId): Promise<AutomationRule | null> {
    const record = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, organizationId: tenantId },
    });
    return record ? toRule(record) : null;
  }

  async listByTenant(tenantId: string): Promise<AutomationRule[]> {
    const records = await this.prisma.automationRule.findMany({
      where: { organizationId: tenantId },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    });
    return records.map(toRule);
  }

  async listEnabledByEvent(tenantId: string, eventName: string): Promise<AutomationRule[]> {
    const records = await this.prisma.automationRule.findMany({
      where: {
        organizationId: tenantId,
        enabled: true,
        triggerType: 'event',
        eventName,
      },
      orderBy: { priority: 'asc' },
    });
    return records.map(toRule);
  }

  async listDueSchedules(now: Date, limit: number): Promise<AutomationRule[]> {
    const records = await this.prisma.automationRule.findMany({
      where: {
        enabled: true,
        triggerType: 'schedule',
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });
    return records.map(toRule);
  }

  async delete(tenantId: string, ruleId: AutomationRuleId): Promise<void> {
    await this.prisma.automationRule.deleteMany({
      where: { id: ruleId, organizationId: tenantId },
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.automationRule.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresAutomationJobRepository implements AutomationJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(job: AutomationJob): Promise<void> {
    const snapshot = job.toSnapshot();
    const data = toJobRecord(snapshot);
    await this.prisma.automationJob.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        attempt: data.attempt,
        runAfter: data.runAfter,
        lastError: data.lastError,
        claimedAt: data.claimedAt,
        completedAt: data.completedAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async tryInsert(job: AutomationJob): Promise<boolean> {
    try {
      await this.prisma.automationJob.create({ data: toJobRecord(job.toSnapshot()) });
      return true;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async findById(tenantId: string, jobId: AutomationJobId): Promise<AutomationJob | null> {
    const record = await this.prisma.automationJob.findFirst({
      where: { id: jobId, organizationId: tenantId },
    });
    return record ? toJob(record) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<AutomationJob | null> {
    const record = await this.prisma.automationJob.findUnique({ where: { idempotencyKey } });
    return record ? toJob(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: AutomationJobListFilter,
  ): Promise<Page<AutomationJob>> {
    const where: Prisma.AutomationJobWhereInput = {
      organizationId: tenantId,
      ...(filter?.ruleId ? { ruleId: filter.ruleId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    };
    return paginate(
      page,
      () => this.prisma.automationJob.count({ where }),
      () =>
        this.prisma.automationJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toJob,
    );
  }

  async claim(tenantId: string, jobId: AutomationJobId, now: Date): Promise<AutomationJob | null> {
    const updated = await this.prisma.automationJob.updateMany({
      where: {
        id: jobId,
        organizationId: tenantId,
        status: 'pending',
        runAfter: { lte: now },
      },
      data: {
        status: 'running',
        claimedAt: now,
        attempt: { increment: 1 },
        updatedAt: now,
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    const record = await this.prisma.automationJob.findFirst({
      where: { id: jobId, organizationId: tenantId },
    });
    return record ? toJob(record) : null;
  }

  async listDue(now: Date, limit: number): Promise<AutomationJob[]> {
    const records = await this.prisma.automationJob.findMany({
      where: { status: 'pending', runAfter: { lte: now } },
      orderBy: { runAfter: 'asc' },
      take: limit,
    });
    return records.map(toJob);
  }

  async reclaimStale(now: Date, staleAfterMs: number, limit: number): Promise<AutomationJob[]> {
    const cutoff = new Date(now.getTime() - staleAfterMs);
    const records = await this.prisma.automationJob.findMany({
      where: { status: 'running', claimedAt: { lte: cutoff } },
      take: limit,
    });
    const reclaimed: AutomationJob[] = [];
    for (const record of records) {
      const updated = await this.prisma.automationJob.updateMany({
        where: { id: record.id, status: 'running' },
        data: { status: 'pending', claimedAt: null, runAfter: now, updatedAt: now },
      });
      if (updated.count !== 1) {
        continue;
      }
      const fresh = await this.prisma.automationJob.findUnique({ where: { id: record.id } });
      if (fresh) {
        reclaimed.push(toJob(fresh));
      }
    }
    return reclaimed;
  }
}

export class PostgresAutomationExecutionLogRepository implements AutomationExecutionLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(log: AutomationExecutionLog): Promise<void> {
    const snapshot = log.toSnapshot();
    const data = toLogRecord(snapshot);
    await this.prisma.automationExecutionLog.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        message: data.message,
        outputSnapshot: data.outputSnapshot,
        finishedAt: data.finishedAt,
      },
    });
  }

  async findById(tenantId: string, logId: AutomationExecutionLogId): Promise<AutomationExecutionLog | null> {
    const record = await this.prisma.automationExecutionLog.findFirst({
      where: { id: logId, organizationId: tenantId },
    });
    return record ? toLog(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: AutomationLogListFilter,
  ): Promise<Page<AutomationExecutionLog>> {
    const where: Prisma.AutomationExecutionLogWhereInput = {
      organizationId: tenantId,
      ...(filter?.ruleId ? { ruleId: filter.ruleId } : {}),
      ...(filter?.jobId ? { jobId: filter.jobId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    };
    return paginate(
      page,
      () => this.prisma.automationExecutionLog.count({ where }),
      () =>
        this.prisma.automationExecutionLog.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toLog,
    );
  }
}

function skip(page: PageRequest): number {
  return (page.page - 1) * page.pageSize;
}

async function paginate<TRecord, TEntity>(
  page: PageRequest,
  count: () => Promise<number>,
  load: () => Promise<TRecord[]>,
  map: (record: TRecord) => TEntity,
): Promise<Page<TEntity>> {
  const [total, records] = await Promise.all([count(), load()]);
  return {
    items: records.map(map),
    total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

function toRuleRecord(snapshot: AutomationRuleSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    name: snapshot.name,
    description: snapshot.description ?? null,
    enabled: snapshot.enabled,
    triggerType: snapshot.triggerType,
    eventName: snapshot.eventName ?? null,
    schedule: snapshot.schedule ?? null,
    matchMode: snapshot.match,
    conditions: snapshot.conditions as unknown as Prisma.InputJsonValue,
    actionType: snapshot.actionType,
    actionConfig: snapshot.action as Prisma.InputJsonValue,
    maxAttempts: snapshot.maxAttempts,
    backoffMs: snapshot.backoffMs,
    priority: snapshot.priority,
    nextRunAt: snapshot.nextRunAt ?? null,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toJobRecord(snapshot: AutomationJobSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    ruleId: snapshot.ruleId,
    triggerKind: snapshot.triggerKind,
    idempotencyKey: snapshot.idempotencyKey,
    eventName: snapshot.eventName ?? null,
    eventId: snapshot.eventId ?? null,
    payload: snapshot.payload as Prisma.InputJsonValue,
    status: snapshot.status,
    attempt: snapshot.attempt,
    maxAttempts: snapshot.maxAttempts,
    runAfter: snapshot.runAfter,
    lastError: snapshot.lastError ?? null,
    claimedAt: snapshot.claimedAt ?? null,
    completedAt: snapshot.completedAt ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toLogRecord(snapshot: AutomationExecutionLogSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    jobId: snapshot.jobId,
    ruleId: snapshot.ruleId,
    attempt: snapshot.attempt,
    status: snapshot.status,
    message: snapshot.message ?? null,
    inputSnapshot: (snapshot.input ?? undefined) as Prisma.InputJsonValue | undefined,
    outputSnapshot: (snapshot.output ?? undefined) as Prisma.InputJsonValue | undefined,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt ?? null,
  };
}

function toRule(record: {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  eventName: string | null;
  schedule: string | null;
  matchMode: string;
  conditions: Prisma.JsonValue;
  actionType: string;
  actionConfig: Prisma.JsonValue;
  maxAttempts: number;
  backoffMs: number;
  priority: number;
  nextRunAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): AutomationRule {
  const snapshot: AutomationRuleSnapshot = {
    id: createAutomationRuleId(record.id),
    organizationId: record.organizationId,
    name: record.name,
    description: record.description ?? undefined,
    enabled: record.enabled,
    triggerType: parseTriggerType(record.triggerType),
    eventName: record.eventName ? (record.eventName as AutomationRuleSnapshot['eventName']) : undefined,
    schedule: record.schedule ?? undefined,
    match: parseMatchMode(record.matchMode),
    conditions: parseConditions(record.conditions),
    actionType: parseActionType(record.actionType),
    action: jsonRecord(record.actionConfig),
    maxAttempts: record.maxAttempts,
    backoffMs: record.backoffMs,
    priority: record.priority,
    nextRunAt: record.nextRunAt ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return AutomationRule.reconstitute(snapshot);
}

function toJob(record: {
  id: string;
  organizationId: string;
  ruleId: string;
  triggerKind: string;
  idempotencyKey: string;
  eventName: string | null;
  eventId: string | null;
  payload: Prisma.JsonValue;
  status: string;
  attempt: number;
  maxAttempts: number;
  runAfter: Date;
  lastError: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AutomationJob {
  const snapshot: AutomationJobSnapshot = {
    id: createAutomationJobId(record.id),
    organizationId: record.organizationId,
    ruleId: createAutomationRuleId(record.ruleId),
    triggerKind: asTriggerKind(record.triggerKind),
    idempotencyKey: record.idempotencyKey,
    eventName: record.eventName ?? undefined,
    eventId: record.eventId ?? undefined,
    payload: payloadRecord(record.payload),
    status: parseJobStatus(record.status),
    attempt: record.attempt,
    maxAttempts: record.maxAttempts,
    runAfter: record.runAfter,
    lastError: record.lastError ?? undefined,
    claimedAt: record.claimedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return AutomationJob.reconstitute(snapshot);
}

function toLog(record: {
  id: string;
  organizationId: string;
  jobId: string;
  ruleId: string;
  attempt: number;
  status: string;
  message: string | null;
  inputSnapshot: Prisma.JsonValue | null;
  outputSnapshot: Prisma.JsonValue | null;
  startedAt: Date;
  finishedAt: Date | null;
}): AutomationExecutionLog {
  const snapshot: AutomationExecutionLogSnapshot = {
    id: createAutomationExecutionLogId(record.id),
    organizationId: record.organizationId,
    jobId: createAutomationJobId(record.jobId),
    ruleId: createAutomationRuleId(record.ruleId),
    attempt: record.attempt,
    status: record.status as AutomationExecutionLogSnapshot['status'],
    message: record.message ?? undefined,
    input: record.inputSnapshot ? jsonRecord(record.inputSnapshot) : undefined,
    output: record.outputSnapshot ? jsonRecord(record.outputSnapshot) : undefined,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt ?? undefined,
  };
  return AutomationExecutionLog.reconstitute(snapshot);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
