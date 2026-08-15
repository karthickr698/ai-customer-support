import type {
  AutomationActionType,
  AutomationMatchMode,
  AutomationSourceEvent,
  AutomationTriggerType,
} from '@ai-customer-support/contracts';
import { parseAction, type AutomationAction, actionToConfig } from './action.js';
import { parseConditions, type AutomationCondition } from './conditions.js';
import { InvalidAutomationError } from './errors.js';
import { createAutomationRuleId, type AutomationRuleId } from './ids.js';
import { computeNextRun, formatSchedule, parseSchedule, type AutomationSchedule } from './schedule.js';
import {
  normalizeOptionalText,
  normalizeText,
  parseActionType,
  parseMatchMode,
  parsePriority,
  parseRetryPolicy,
  parseSourceEvent,
  parseTriggerType,
} from './values.js';

export type AutomationRuleSnapshot = {
  readonly id: AutomationRuleId;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly enabled: boolean;
  readonly triggerType: AutomationTriggerType;
  readonly eventName: AutomationSourceEvent | undefined;
  readonly schedule: string | undefined;
  readonly match: AutomationMatchMode;
  readonly conditions: readonly AutomationCondition[];
  readonly actionType: AutomationActionType;
  readonly action: Record<string, unknown>;
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly priority: number;
  readonly nextRunAt: Date | undefined;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class AutomationRule {
  private constructor(
    readonly id: AutomationRuleId,
    readonly organizationId: string,
    private nameValue: string,
    private descriptionValue: string | undefined,
    private enabledValue: boolean,
    private triggerTypeValue: AutomationTriggerType,
    private eventNameValue: AutomationSourceEvent | undefined,
    private scheduleValue: AutomationSchedule | undefined,
    private matchValue: AutomationMatchMode,
    private conditionsValue: readonly AutomationCondition[],
    private actionValue: AutomationAction,
    private maxAttemptsValue: number,
    private backoffMsValue: number,
    private priorityValue: number,
    private nextRunAtValue: Date | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly triggerType: string;
    readonly actionType: string;
    readonly description?: string;
    readonly enabled?: boolean;
    readonly eventName?: string;
    readonly schedule?: string;
    readonly match?: string;
    readonly conditions?: unknown;
    readonly action?: unknown;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly priority?: number;
    readonly allowLocalHttp?: boolean;
    readonly id?: AutomationRuleId;
  }): AutomationRule {
    if (!input.organizationId.trim()) {
      throw new InvalidAutomationError('Organization is required');
    }
    const triggerType = parseTriggerType(input.triggerType);
    const retry = parseRetryPolicy(input);
    const schedule = triggerType === 'schedule' ? parseRequiredSchedule(input.schedule) : undefined;
    const eventName = triggerType === 'event' ? parseRequiredEvent(input.eventName) : undefined;
    return new AutomationRule(
      input.id ?? createAutomationRuleId(),
      input.organizationId,
      normalizeText(input.name, 'Name', 1, 80),
      normalizeOptionalText(input.description, 'Description', 500),
      input.enabled ?? true,
      triggerType,
      eventName,
      schedule,
      parseMatchMode(input.match),
      parseConditions(input.conditions),
      parseAction(parseActionType(input.actionType), input.action, { allowLocalHttp: input.allowLocalHttp }),
      retry.maxAttempts,
      retry.backoffMs,
      parsePriority(input.priority),
      schedule ? computeNextRun(input.now, schedule) : undefined,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: AutomationRuleSnapshot): AutomationRule {
    return new AutomationRule(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.description,
      snapshot.enabled,
      snapshot.triggerType,
      snapshot.eventName,
      snapshot.schedule ? parseSchedule(snapshot.schedule) : undefined,
      snapshot.match,
      snapshot.conditions,
      parseAction(snapshot.actionType, snapshot.action, { allowLocalHttp: true }),
      snapshot.maxAttempts,
      snapshot.backoffMs,
      snapshot.priority,
      snapshot.nextRunAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this.nameValue;
  }

  get description(): string | undefined {
    return this.descriptionValue;
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get triggerType(): AutomationTriggerType {
    return this.triggerTypeValue;
  }

  get eventName(): AutomationSourceEvent | undefined {
    return this.eventNameValue;
  }

  get scheduleExpression(): string | undefined {
    return this.scheduleValue ? formatSchedule(this.scheduleValue) : undefined;
  }

  get match(): AutomationMatchMode {
    return this.matchValue;
  }

  get conditions(): readonly AutomationCondition[] {
    return this.conditionsValue;
  }

  get action(): AutomationAction {
    return this.actionValue;
  }

  get maxAttempts(): number {
    return this.maxAttemptsValue;
  }

  get backoffMs(): number {
    return this.backoffMsValue;
  }

  get priority(): number {
    return this.priorityValue;
  }

  get nextRunAt(): Date | undefined {
    return this.nextRunAtValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  matchesEvent(eventName: string): boolean {
    return this.enabledValue && this.triggerTypeValue === 'event' && this.eventNameValue === eventName;
  }

  isDue(now: Date): boolean {
    return (
      this.enabledValue &&
      this.triggerTypeValue === 'schedule' &&
      this.nextRunAtValue !== undefined &&
      this.nextRunAtValue.getTime() <= now.getTime()
    );
  }

  setEnabled(enabled: boolean, now: Date): void {
    this.enabledValue = enabled;
    if (enabled && this.triggerTypeValue === 'schedule' && this.scheduleValue) {
      this.nextRunAtValue = computeNextRun(now, this.scheduleValue);
    }
    if (!enabled) {
      this.nextRunAtValue = undefined;
    }
    this.updatedAtValue = now;
  }

  advanceSchedule(from: Date): Date {
    if (!this.scheduleValue) {
      throw new InvalidAutomationError('Schedule is required for scheduled rules');
    }
    const slot = this.nextRunAtValue ?? from;
    this.nextRunAtValue = computeNextRun(slot, this.scheduleValue);
    this.updatedAtValue = from;
    return slot;
  }

  update(
    input: {
      readonly name?: string;
      readonly description?: string | null;
      readonly enabled?: boolean;
      readonly triggerType?: string;
      readonly eventName?: string | null;
      readonly schedule?: string | null;
      readonly match?: string;
      readonly conditions?: unknown;
      readonly actionType?: string;
      readonly action?: unknown;
      readonly maxAttempts?: number;
      readonly backoffMs?: number;
      readonly priority?: number;
      readonly allowLocalHttp?: boolean;
    },
    now: Date,
  ): void {
    if (input.name !== undefined) {
      this.nameValue = normalizeText(input.name, 'Name', 1, 80);
    }
    if (input.description !== undefined) {
      this.descriptionValue = normalizeOptionalText(input.description, 'Description', 500);
    }
    if (input.triggerType !== undefined) {
      this.triggerTypeValue = parseTriggerType(input.triggerType);
    }
    if (input.match !== undefined) {
      this.matchValue = parseMatchMode(input.match);
    }
    if (input.conditions !== undefined) {
      this.conditionsValue = parseConditions(input.conditions);
    }
    if (input.actionType !== undefined || input.action !== undefined) {
      const type = parseActionType(input.actionType ?? this.actionValue.type);
      this.actionValue = parseAction(type, input.action ?? actionToConfig(this.actionValue), {
        allowLocalHttp: input.allowLocalHttp,
      });
    }
    if (input.maxAttempts !== undefined || input.backoffMs !== undefined) {
      const retry = parseRetryPolicy({
        maxAttempts: input.maxAttempts ?? this.maxAttemptsValue,
        backoffMs: input.backoffMs ?? this.backoffMsValue,
      });
      this.maxAttemptsValue = retry.maxAttempts;
      this.backoffMsValue = retry.backoffMs;
    }
    if (input.priority !== undefined) {
      this.priorityValue = parsePriority(input.priority);
    }
    if (input.triggerType !== undefined || input.eventName !== undefined || input.schedule !== undefined) {
      this.applyTriggerFields(input, now);
    }
    if (input.enabled !== undefined) {
      this.setEnabled(input.enabled, now);
    } else {
      this.updatedAtValue = now;
    }
  }

  toSnapshot(): AutomationRuleSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.nameValue,
      description: this.descriptionValue,
      enabled: this.enabledValue,
      triggerType: this.triggerTypeValue,
      eventName: this.eventNameValue,
      schedule: this.scheduleExpression,
      match: this.matchValue,
      conditions: this.conditionsValue,
      actionType: this.actionValue.type,
      action: actionToConfig(this.actionValue),
      maxAttempts: this.maxAttemptsValue,
      backoffMs: this.backoffMsValue,
      priority: this.priorityValue,
      nextRunAt: this.nextRunAtValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }

  private applyTriggerFields(
    input: {
      readonly triggerType?: string;
      readonly eventName?: string | null;
      readonly schedule?: string | null;
    },
    now: Date,
  ): void {
    if (this.triggerTypeValue === 'event') {
      if (input.eventName !== undefined) {
        this.eventNameValue = input.eventName === null ? undefined : parseRequiredEvent(input.eventName);
      }
      if (!this.eventNameValue) {
        throw new InvalidAutomationError('eventName is required for event triggers');
      }
      this.scheduleValue = undefined;
      this.nextRunAtValue = undefined;
      return;
    }
    if (input.schedule !== undefined) {
      this.scheduleValue = input.schedule === null ? undefined : parseRequiredSchedule(input.schedule);
    }
    if (!this.scheduleValue) {
      throw new InvalidAutomationError('schedule is required for schedule triggers');
    }
    this.eventNameValue = undefined;
    this.nextRunAtValue = computeNextRun(now, this.scheduleValue);
  }
}

function parseRequiredEvent(value: string | undefined): AutomationSourceEvent {
  if (!value?.trim()) {
    throw new InvalidAutomationError('eventName is required for event triggers');
  }
  return parseSourceEvent(value);
}

function parseRequiredSchedule(value: string | undefined): AutomationSchedule {
  if (!value?.trim()) {
    throw new InvalidAutomationError('schedule is required for schedule triggers');
  }
  return parseSchedule(value);
}
