import type { AutomationJobStatus } from '@ai-customer-support/contracts';
import { InvalidAutomationError, InvalidAutomationStateError } from './errors.js';
import { createAutomationJobId, type AutomationJobId, type AutomationRuleId } from './ids.js';
import { jsonRecord, parseJobStatus, retryDelayMs } from './values.js';

export type AutomationTriggerKind = 'event' | 'schedule' | 'manual';

export type AutomationJobSnapshot = {
  readonly id: AutomationJobId;
  readonly organizationId: string;
  readonly ruleId: AutomationRuleId;
  readonly triggerKind: AutomationTriggerKind;
  readonly idempotencyKey: string;
  readonly eventName: string | undefined;
  readonly eventId: string | undefined;
  readonly payload: Record<string, unknown>;
  readonly status: AutomationJobStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly runAfter: Date;
  readonly lastError: string | undefined;
  readonly claimedAt: Date | undefined;
  readonly completedAt: Date | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class AutomationJob {
  private constructor(
    readonly id: AutomationJobId,
    readonly organizationId: string,
    readonly ruleId: AutomationRuleId,
    readonly triggerKind: AutomationTriggerKind,
    readonly idempotencyKey: string,
    readonly eventName: string | undefined,
    readonly eventId: string | undefined,
    readonly payload: Record<string, unknown>,
    private statusValue: AutomationJobStatus,
    private attemptValue: number,
    readonly maxAttempts: number,
    private runAfterValue: Date,
    private lastErrorValue: string | undefined,
    private claimedAtValue: Date | undefined,
    private completedAtValue: Date | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly ruleId: AutomationRuleId;
    readonly triggerKind: AutomationTriggerKind;
    readonly idempotencyKey: string;
    readonly now: Date;
    readonly maxAttempts: number;
    readonly eventName?: string;
    readonly eventId?: string;
    readonly payload?: Record<string, unknown>;
    readonly runAfter?: Date;
    readonly id?: AutomationJobId;
  }): AutomationJob {
    if (!input.organizationId.trim()) {
      throw new InvalidAutomationError('Organization is required');
    }
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) {
      throw new InvalidAutomationError('Idempotency key is required');
    }
    return new AutomationJob(
      input.id ?? createAutomationJobId(),
      input.organizationId,
      input.ruleId,
      input.triggerKind,
      input.idempotencyKey.trim(),
      input.eventName,
      input.eventId,
      input.payload ?? {},
      'pending',
      0,
      input.maxAttempts,
      input.runAfter ?? input.now,
      undefined,
      undefined,
      undefined,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: AutomationJobSnapshot): AutomationJob {
    return new AutomationJob(
      snapshot.id,
      snapshot.organizationId,
      snapshot.ruleId,
      snapshot.triggerKind,
      snapshot.idempotencyKey,
      snapshot.eventName,
      snapshot.eventId,
      snapshot.payload,
      snapshot.status,
      snapshot.attempt,
      snapshot.maxAttempts,
      snapshot.runAfter,
      snapshot.lastError,
      snapshot.claimedAt,
      snapshot.completedAt,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): AutomationJobStatus {
    return this.statusValue;
  }

  get attempt(): number {
    return this.attemptValue;
  }

  get runAfter(): Date {
    return this.runAfterValue;
  }

  get lastError(): string | undefined {
    return this.lastErrorValue;
  }

  get claimedAt(): Date | undefined {
    return this.claimedAtValue;
  }

  get completedAt(): Date | undefined {
    return this.completedAtValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  isTerminal(): boolean {
    return this.statusValue === 'succeeded' || this.statusValue === 'skipped' || this.statusValue === 'dead';
  }

  applyClaim(attempt: number, claimedAt: Date): void {
    this.statusValue = 'running';
    this.attemptValue = attempt;
    this.claimedAtValue = claimedAt;
    this.updatedAtValue = claimedAt;
  }

  markSucceeded(now: Date): void {
    if (this.statusValue !== 'running') {
      throw new InvalidAutomationStateError('Only a running job can succeed');
    }
    this.statusValue = 'succeeded';
    this.lastErrorValue = undefined;
    this.completedAtValue = now;
    this.updatedAtValue = now;
  }

  markSkipped(now: Date, reason: string): void {
    this.statusValue = 'skipped';
    this.lastErrorValue = reason;
    this.completedAtValue = now;
    this.updatedAtValue = now;
  }

  markFailed(input: { readonly now: Date; readonly error: string; readonly backoffMs: number }): void {
    if (this.statusValue !== 'running') {
      throw new InvalidAutomationStateError('Only a running job can fail');
    }
    this.lastErrorValue = input.error.slice(0, 2_000);
    this.updatedAtValue = input.now;
    if (this.attemptValue >= this.maxAttempts) {
      this.statusValue = 'dead';
      this.completedAtValue = input.now;
      return;
    }
    this.statusValue = 'pending';
    this.runAfterValue = new Date(input.now.getTime() + retryDelayMs(this.attemptValue, input.backoffMs));
    this.claimedAtValue = undefined;
  }

  scheduleRetry(now: Date): void {
    if (this.statusValue !== 'dead' && this.statusValue !== 'skipped') {
      throw new InvalidAutomationStateError('Only a dead or skipped job can be retried');
    }
    this.statusValue = 'pending';
    this.runAfterValue = now;
    this.completedAtValue = undefined;
    this.claimedAtValue = undefined;
    this.lastErrorValue = undefined;
    this.updatedAtValue = now;
  }

  toSnapshot(): AutomationJobSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      ruleId: this.ruleId,
      triggerKind: this.triggerKind,
      idempotencyKey: this.idempotencyKey,
      eventName: this.eventName,
      eventId: this.eventId,
      payload: this.payload,
      status: parseJobStatus(this.statusValue),
      attempt: this.attemptValue,
      maxAttempts: this.maxAttempts,
      runAfter: this.runAfterValue,
      lastError: this.lastErrorValue,
      claimedAt: this.claimedAtValue,
      completedAt: this.completedAtValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export function eventIdempotencyKey(tenantId: string, ruleId: string, eventId: string): string {
  return `evt:${tenantId}:${ruleId}:${eventId}`;
}

export function scheduleIdempotencyKey(tenantId: string, ruleId: string, slot: Date): string {
  return `sch:${tenantId}:${ruleId}:${slot.toISOString()}`;
}

export function manualIdempotencyKey(tenantId: string, ruleId: string, key: string): string {
  return `man:${tenantId}:${ruleId}:${key}`;
}

export function asTriggerKind(value: string): AutomationTriggerKind {
  if (value === 'event' || value === 'schedule' || value === 'manual') {
    return value;
  }
  return 'event';
}

export function payloadRecord(value: unknown): Record<string, unknown> {
  return jsonRecord(value);
}
