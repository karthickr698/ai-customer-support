import type { TicketEscalationAction, TicketEscalationTriggerType } from '@ai-customer-support/contracts';
import { InvalidTicketError } from './errors.js';
import { createTicketEscalationPolicyId, type TicketEscalationPolicyId } from './ids.js';
import { isDue } from './sla-timer.js';
import type { Ticket } from './ticket.js';
import {
  canEscalateFrom,
  normalizeText,
  parseEscalationAction,
  parseEscalationTriggerType,
} from './values.js';

export type TicketEscalationMatchContext = {
  readonly now: Date;
};

export type TicketEscalationPolicySnapshot = {
  readonly id: TicketEscalationPolicyId;
  readonly organizationId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly triggerType: TicketEscalationTriggerType;
  readonly triggerMinutes: number | undefined;
  readonly action: TicketEscalationAction;
  readonly priority: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class TicketEscalationPolicy {
  private constructor(
    readonly id: TicketEscalationPolicyId,
    readonly organizationId: string,
    private nameValue: string,
    private enabledValue: boolean,
    private triggerTypeValue: TicketEscalationTriggerType,
    private triggerMinutesValue: number | undefined,
    private actionValue: TicketEscalationAction,
    private priorityValue: number,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly triggerType: string;
    readonly action: string;
    readonly now: Date;
    readonly triggerMinutes?: number;
    readonly enabled?: boolean;
    readonly priority?: number;
    readonly id?: TicketEscalationPolicyId;
  }): TicketEscalationPolicy {
    if (!input.organizationId.trim()) {
      throw new InvalidTicketError('Organization is required');
    }
    const triggerType = parseEscalationTriggerType(input.triggerType);
    return new TicketEscalationPolicy(
      input.id ?? createTicketEscalationPolicyId(),
      input.organizationId,
      normalizeText(input.name, 'Name', 1, 80),
      input.enabled ?? true,
      triggerType,
      normalizeTriggerMinutes(triggerType, input.triggerMinutes),
      parseEscalationAction(input.action),
      normalizePriority(input.priority ?? 100),
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: TicketEscalationPolicySnapshot): TicketEscalationPolicy {
    return new TicketEscalationPolicy(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.enabled,
      snapshot.triggerType,
      snapshot.triggerMinutes,
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

  get triggerType(): TicketEscalationTriggerType {
    return this.triggerTypeValue;
  }

  get triggerMinutes(): number | undefined {
    return this.triggerMinutesValue;
  }

  get action(): TicketEscalationAction {
    return this.actionValue;
  }

  get priority(): number {
    return this.priorityValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  update(
    input: {
      readonly name?: string;
      readonly enabled?: boolean;
      readonly triggerType?: string;
      readonly triggerMinutes?: number | null;
      readonly action?: string;
      readonly priority?: number;
    },
    now: Date,
  ): void {
    if (input.name !== undefined) {
      this.nameValue = normalizeText(input.name, 'Name', 1, 80);
    }
    if (input.enabled !== undefined) {
      this.enabledValue = input.enabled;
    }
    if (input.triggerType !== undefined) {
      this.triggerTypeValue = parseEscalationTriggerType(input.triggerType);
    }
    if (input.triggerMinutes !== undefined || input.triggerType !== undefined) {
      this.triggerMinutesValue = normalizeTriggerMinutes(
        this.triggerTypeValue,
        input.triggerMinutes === null ? undefined : (input.triggerMinutes ?? this.triggerMinutesValue),
      );
    }
    if (input.action !== undefined) {
      this.actionValue = parseEscalationAction(input.action);
    }
    if (input.priority !== undefined) {
      this.priorityValue = normalizePriority(input.priority);
    }
    this.updatedAtValue = now;
  }

  matches(ticket: Ticket, context: TicketEscalationMatchContext): boolean {
    if (!this.enabledValue || !ticket.isActive) {
      return false;
    }
    const mutatesStatus = this.actionValue === 'mark_escalated' || this.actionValue === 'escalate_and_unassign';
    if (mutatesStatus && !canEscalateFrom(ticket.status)) {
      return false;
    }

    switch (this.triggerTypeValue) {
      case 'first_response_overdue':
        return ticket.firstRespondedAt === undefined && isDue(ticket.firstResponseDueAt, context.now);
      case 'resolution_overdue':
        return ticket.resolvedAt === undefined && isDue(ticket.resolutionDueAt, context.now);
      case 'unassigned_for':
        return (
          ticket.assignedAgentId === undefined &&
          isOlderThan(ticket.createdAt, context.now, this.triggerMinutesValue ?? 0)
        );
    }
  }

  toSnapshot(): TicketEscalationPolicySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.nameValue,
      enabled: this.enabledValue,
      triggerType: this.triggerTypeValue,
      triggerMinutes: this.triggerMinutesValue,
      action: this.actionValue,
      priority: this.priorityValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export class TicketEscalationPolicyMatcher {
  static firstMatch(
    policies: readonly TicketEscalationPolicy[],
    ticket: Ticket,
    context: TicketEscalationMatchContext,
  ): TicketEscalationPolicy | undefined {
    const ordered = [...policies].sort(
      (left, right) => left.priority - right.priority || left.createdAt.getTime() - right.createdAt.getTime(),
    );
    return ordered.find((policy) => policy.matches(ticket, context));
  }
}

function normalizeTriggerMinutes(
  triggerType: TicketEscalationTriggerType,
  minutes: number | undefined,
): number | undefined {
  if (triggerType !== 'unassigned_for') {
    return undefined;
  }
  if (minutes === undefined) {
    throw new InvalidTicketError('Unassigned escalation requires triggerMinutes');
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10_080) {
    throw new InvalidTicketError('triggerMinutes must be between 1 and 10080');
  }
  return minutes;
}

function normalizePriority(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 1_000) {
    throw new InvalidTicketError('Priority must be an integer between 1 and 1000');
  }
  return value;
}

function isOlderThan(from: Date, now: Date, minutes: number): boolean {
  return now.getTime() - from.getTime() >= minutes * 60_000;
}
