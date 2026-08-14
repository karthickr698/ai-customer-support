import { Conversation } from './conversation.js';
import { canEscalateFrom } from './conversation-status.js';
import { InvalidEscalationRuleError } from './errors.js';
import { createEscalationRuleId, type EscalationRuleId } from './escalation-rule-id.js';
import {
  parseEscalationAction,
  type EscalationAction,
  type EscalationTrigger,
} from './escalation-trigger.js';

const MAX_NAME = 80;

export type EscalationMatchContext = {
  readonly now: Date;
  readonly messageBody?: string;
  readonly assigneeOnline?: boolean;
};

export type EscalationRuleSnapshot = {
  readonly id: EscalationRuleId;
  readonly organizationId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: EscalationTrigger;
  readonly action: EscalationAction;
  readonly priority: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class EscalationRule {
  private constructor(
    readonly id: EscalationRuleId,
    readonly organizationId: string,
    private nameValue: string,
    private enabledValue: boolean,
    private triggerValue: EscalationTrigger,
    private actionValue: EscalationAction,
    private priorityValue: number,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly trigger: EscalationTrigger;
    readonly action: EscalationAction;
    readonly now: Date;
    readonly enabled?: boolean;
    readonly priority?: number;
    readonly id?: EscalationRuleId;
  }): EscalationRule {
    return new EscalationRule(
      input.id ?? createEscalationRuleId(),
      input.organizationId,
      normalizeName(input.name),
      input.enabled ?? true,
      input.trigger,
      input.action,
      normalizePriority(input.priority ?? 100),
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: EscalationRuleSnapshot): EscalationRule {
    return new EscalationRule(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.enabled,
      snapshot.trigger,
      snapshot.action,
      snapshot.priority,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this.nameValue;
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get trigger(): EscalationTrigger {
    return this.triggerValue;
  }

  get action(): EscalationAction {
    return this.actionValue;
  }

  get priority(): number {
    return this.priorityValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isTimeBased(): boolean {
    return this.triggerValue.type === 'unanswered_for' || this.triggerValue.type === 'unassigned_for';
  }

  update(
    input: {
      readonly name?: string;
      readonly enabled?: boolean;
      readonly trigger?: EscalationTrigger;
      readonly action?: EscalationAction;
      readonly priority?: number;
    },
    now: Date,
  ): void {
    if (input.name !== undefined) {
      this.nameValue = normalizeName(input.name);
    }

    if (input.enabled !== undefined) {
      this.enabledValue = input.enabled;
    }

    if (input.trigger) {
      this.triggerValue = input.trigger;
    }

    if (input.action) {
      this.actionValue = parseEscalationAction(input.action);
    }

    if (input.priority !== undefined) {
      this.priorityValue = normalizePriority(input.priority);
    }

    this.updatedAtValue = now;
  }

  matches(conversation: Conversation, context: EscalationMatchContext): boolean {
    if (!this.enabledValue) {
      return false;
    }

    if (!canEscalateFrom(conversation.status) && this.actionValue !== 'assign_available') {
      return false;
    }

    if (!canEscalateFrom(conversation.status) && this.actionValue === 'assign_available') {
      return false;
    }

    switch (this.triggerValue.type) {
      case 'unanswered_for':
        return isOlderThan(
          conversation.lastMessageAt,
          context.now,
          this.triggerValue.minutes,
        ) && conversation.lastMessageAuthorType === 'customer';
      case 'unassigned_for':
        return (
          conversation.assignedAgentId === undefined &&
          isOlderThan(conversation.lastMessageAt ?? conversation.createdAt, context.now, this.triggerValue.minutes)
        );
      case 'assigned_agent_offline':
        return conversation.assignedAgentId !== undefined && context.assigneeOnline === false;
      case 'keyword_match': {
        const body = context.messageBody?.toLowerCase();
        if (!body) {
          return false;
        }

        return this.triggerValue.keywords.some((keyword) => body.includes(keyword));
      }
    }
  }

  toSnapshot(): EscalationRuleSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.nameValue,
      enabled: this.enabledValue,
      trigger: this.triggerValue,
      action: this.actionValue,
      priority: this.priorityValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export class EscalationPolicy {
  static firstMatch(
    rules: readonly EscalationRule[],
    conversation: Conversation,
    context: EscalationMatchContext,
  ): EscalationRule | undefined {
    const ordered = [...rules].sort((left, right) => left.priority - right.priority || left.createdAt.getTime() - right.createdAt.getTime());
    return ordered.find((rule) => rule.matches(conversation, context));
  }
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    throw new InvalidEscalationRuleError(`Name must be between 1 and ${MAX_NAME} characters`);
  }

  return name;
}

function normalizePriority(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 1_000) {
    throw new InvalidEscalationRuleError('Priority must be an integer between 1 and 1000');
  }

  return value;
}

function isOlderThan(from: Date | undefined, now: Date, minutes: number): boolean {
  if (!from) {
    return false;
  }

  return now.getTime() - from.getTime() >= minutes * 60_000;
}
