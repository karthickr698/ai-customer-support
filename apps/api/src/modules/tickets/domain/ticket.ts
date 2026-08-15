import type { SlaBreachKind, TicketPriority, TicketSource, TicketStatus } from '@ai-customer-support/contracts';
import { InvalidTicketError } from './errors.js';
import { createTicketId, type TicketId, type TicketSlaPolicyId } from './ids.js';
import { addMinutes, elapsedMs, shiftDueDate } from './sla-timer.js';
import {
  assertStatusTransition,
  bumpPriority,
  canEscalateFrom,
  isOpenLifecycle,
  normalizeEmail,
  normalizeText,
  parseSlaBreachKind,
  parseTicketPriority,
  parseTicketSource,
  parseTicketStatus,
  requireUuid,
} from './values.js';

export type TicketSnapshot = {
  readonly id: TicketId;
  readonly organizationId: string;
  readonly conversationId: string | undefined;
  readonly customerId: string | undefined;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly subject: string;
  readonly description: string;
  readonly status: TicketStatus;
  readonly priority: TicketPriority;
  readonly source: TicketSource;
  readonly assignedAgentId: string | undefined;
  readonly escalatedAt: Date | undefined;
  readonly firstRespondedAt: Date | undefined;
  readonly resolvedAt: Date | undefined;
  readonly closedAt: Date | undefined;
  readonly slaPolicyId: TicketSlaPolicyId | undefined;
  readonly firstResponseDueAt: Date | undefined;
  readonly resolutionDueAt: Date | undefined;
  readonly slaPausedAt: Date | undefined;
  readonly slaBreachedAt: Date | undefined;
  readonly slaBreachKind: SlaBreachKind | undefined;
  readonly createdByUserId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Ticket {
  private constructor(
    readonly id: TicketId,
    readonly organizationId: string,
    private conversationIdValue: string | undefined,
    private customerIdValue: string | undefined,
    private customerEmailValue: string,
    private customerNameValue: string,
    private subjectValue: string,
    private descriptionValue: string,
    private statusValue: TicketStatus,
    private priorityValue: TicketPriority,
    readonly source: TicketSource,
    private assignedAgentIdValue: string | undefined,
    private escalatedAtValue: Date | undefined,
    private firstRespondedAtValue: Date | undefined,
    private resolvedAtValue: Date | undefined,
    private closedAtValue: Date | undefined,
    private slaPolicyIdValue: TicketSlaPolicyId | undefined,
    private firstResponseDueAtValue: Date | undefined,
    private resolutionDueAtValue: Date | undefined,
    private slaPausedAtValue: Date | undefined,
    private slaBreachedAtValue: Date | undefined,
    private slaBreachKindValue: SlaBreachKind | undefined,
    readonly createdByUserId: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly subject: string;
    readonly description: string;
    readonly now: Date;
    readonly customerId?: string;
    readonly conversationId?: string;
    readonly priority?: string;
    readonly source?: string;
    readonly assignedAgentId?: string;
    readonly createdByUserId?: string;
    readonly id?: TicketId;
  }): Ticket {
    if (!input.organizationId.trim()) {
      throw new InvalidTicketError('Organization is required');
    }
    return new Ticket(
      input.id ?? createTicketId(),
      input.organizationId,
      requireUuid(input.conversationId, 'conversationId'),
      requireUuid(input.customerId, 'customerId'),
      normalizeEmail(input.customerEmail),
      normalizeText(input.customerName, 'Customer name', 1, 80),
      normalizeText(input.subject, 'Subject', 1, 200),
      normalizeText(input.description, 'Description', 1, 8_000),
      'open',
      parseTicketPriority(input.priority),
      parseTicketSource(input.source),
      requireUuid(input.assignedAgentId, 'assignedAgentId'),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: TicketSnapshot): Ticket {
    return new Ticket(
      snapshot.id,
      snapshot.organizationId,
      snapshot.conversationId,
      snapshot.customerId,
      snapshot.customerEmail,
      snapshot.customerName,
      snapshot.subject,
      snapshot.description,
      parseTicketStatus(snapshot.status),
      parseTicketPriority(snapshot.priority),
      parseTicketSource(snapshot.source),
      snapshot.assignedAgentId,
      snapshot.escalatedAt,
      snapshot.firstRespondedAt,
      snapshot.resolvedAt,
      snapshot.closedAt,
      snapshot.slaPolicyId,
      snapshot.firstResponseDueAt,
      snapshot.resolutionDueAt,
      snapshot.slaPausedAt,
      snapshot.slaBreachedAt,
      snapshot.slaBreachKind,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get conversationId(): string | undefined {
    return this.conversationIdValue;
  }

  get customerId(): string | undefined {
    return this.customerIdValue;
  }

  get customerEmail(): string {
    return this.customerEmailValue;
  }

  get customerName(): string {
    return this.customerNameValue;
  }

  get subject(): string {
    return this.subjectValue;
  }

  get description(): string {
    return this.descriptionValue;
  }

  get status(): TicketStatus {
    return this.statusValue;
  }

  get priority(): TicketPriority {
    return this.priorityValue;
  }

  get assignedAgentId(): string | undefined {
    return this.assignedAgentIdValue;
  }

  get escalatedAt(): Date | undefined {
    return this.escalatedAtValue;
  }

  get firstRespondedAt(): Date | undefined {
    return this.firstRespondedAtValue;
  }

  get resolvedAt(): Date | undefined {
    return this.resolvedAtValue;
  }

  get closedAt(): Date | undefined {
    return this.closedAtValue;
  }

  get slaPolicyId(): TicketSlaPolicyId | undefined {
    return this.slaPolicyIdValue;
  }

  get firstResponseDueAt(): Date | undefined {
    return this.firstResponseDueAtValue;
  }

  get resolutionDueAt(): Date | undefined {
    return this.resolutionDueAtValue;
  }

  get slaPausedAt(): Date | undefined {
    return this.slaPausedAtValue;
  }

  get slaBreachedAt(): Date | undefined {
    return this.slaBreachedAtValue;
  }

  get slaBreachKind(): SlaBreachKind | undefined {
    return this.slaBreachKindValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isActive(): boolean {
    return isOpenLifecycle(this.statusValue);
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  applySla(
    input: {
      readonly policyId?: TicketSlaPolicyId;
      readonly firstResponseMinutes: number;
      readonly resolutionMinutes: number;
    },
    now: Date,
  ): void {
    this.slaPolicyIdValue = input.policyId;
    this.firstResponseDueAtValue = addMinutes(this.createdAt, input.firstResponseMinutes);
    this.resolutionDueAtValue = addMinutes(this.createdAt, input.resolutionMinutes);
    this.updatedAtValue = now;
  }

  recordFirstResponse(now: Date): void {
    if (this.firstRespondedAtValue) {
      return;
    }
    this.firstRespondedAtValue = now;
    this.updatedAtValue = now;
  }

  assignTo(agentId: string, now: Date): void {
    this.assignedAgentIdValue = agentId;
    this.recordFirstResponse(now);
    this.updatedAtValue = now;
  }

  unassign(now: Date): void {
    this.assignedAgentIdValue = undefined;
    this.updatedAtValue = now;
  }

  raisePriority(now: Date): boolean {
    const next = bumpPriority(this.priorityValue);
    if (next === this.priorityValue) {
      return false;
    }
    this.priorityValue = next;
    this.updatedAtValue = now;
    return true;
  }

  escalate(now: Date): void {
    if (this.statusValue === 'escalated') {
      this.raisePriority(now);
      this.updatedAtValue = now;
      return;
    }
    if (!canEscalateFrom(this.statusValue)) {
      throw new InvalidTicketError(`Cannot escalate a ticket that is ${this.statusValue}`);
    }
    this.resumeSla(now);
    this.statusValue = 'escalated';
    this.escalatedAtValue = now;
    this.raisePriority(now);
    this.recordFirstResponse(now);
    this.updatedAtValue = now;
  }

  transitionTo(status: TicketStatus, now: Date): void {
    assertStatusTransition(this.statusValue, status);
    if (this.statusValue === status) {
      return;
    }

    const from = this.statusValue;
    if (from === 'pending') {
      this.resumeSla(now);
    }

    this.statusValue = status;
    this.updatedAtValue = now;

    if (status === 'pending') {
      this.pauseSla(now);
      this.recordFirstResponse(now);
    }
    if (status === 'resolved') {
      this.resolvedAtValue = now;
      this.closedAtValue = undefined;
      this.recordFirstResponse(now);
    }
    if (status === 'closed') {
      this.closedAtValue = now;
      this.resolvedAtValue = this.resolvedAtValue ?? now;
      this.recordFirstResponse(now);
    }
    if (status === 'open' && (from === 'resolved' || from === 'closed')) {
      this.resolvedAtValue = undefined;
      this.closedAtValue = undefined;
      this.slaBreachedAtValue = undefined;
      this.slaBreachKindValue = undefined;
      if (this.resolutionDueAtValue) {
        const window = elapsedMs(this.createdAt, this.resolutionDueAtValue);
        this.resolutionDueAtValue = new Date(now.getTime() + window);
      }
    }
    if (status === 'escalated') {
      this.escalatedAtValue = now;
      this.recordFirstResponse(now);
    }
  }

  markSlaBreached(kind: string, now: Date): boolean {
    if (this.slaBreachedAtValue) {
      return false;
    }
    this.slaBreachedAtValue = now;
    this.slaBreachKindValue = parseSlaBreachKind(kind);
    this.updatedAtValue = now;
    return true;
  }

  firstResponseOverdue(now: Date): boolean {
    return (
      this.isActive &&
      !this.firstRespondedAtValue &&
      !this.slaPausedAtValue &&
      Boolean(this.firstResponseDueAtValue && now.getTime() >= this.firstResponseDueAtValue.getTime())
    );
  }

  resolutionOverdue(now: Date): boolean {
    return (
      this.isActive &&
      !this.resolvedAtValue &&
      !this.slaPausedAtValue &&
      Boolean(this.resolutionDueAtValue && now.getTime() >= this.resolutionDueAtValue.getTime())
    );
  }

  toSnapshot(): TicketSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      conversationId: this.conversationIdValue,
      customerId: this.customerIdValue,
      customerEmail: this.customerEmailValue,
      customerName: this.customerNameValue,
      subject: this.subjectValue,
      description: this.descriptionValue,
      status: this.statusValue,
      priority: this.priorityValue,
      source: this.source,
      assignedAgentId: this.assignedAgentIdValue,
      escalatedAt: this.escalatedAtValue,
      firstRespondedAt: this.firstRespondedAtValue,
      resolvedAt: this.resolvedAtValue,
      closedAt: this.closedAtValue,
      slaPolicyId: this.slaPolicyIdValue,
      firstResponseDueAt: this.firstResponseDueAtValue,
      resolutionDueAt: this.resolutionDueAtValue,
      slaPausedAt: this.slaPausedAtValue,
      slaBreachedAt: this.slaBreachedAtValue,
      slaBreachKind: this.slaBreachKindValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }

  private pauseSla(now: Date): void {
    if (this.slaPausedAtValue) {
      return;
    }
    this.slaPausedAtValue = now;
  }

  private resumeSla(now: Date): void {
    if (!this.slaPausedAtValue) {
      return;
    }
    const elapsed = elapsedMs(this.slaPausedAtValue, now);
    this.firstResponseDueAtValue = shiftDueDate(this.firstResponseDueAtValue, elapsed);
    this.resolutionDueAtValue = shiftDueDate(this.resolutionDueAtValue, elapsed);
    this.slaPausedAtValue = undefined;
  }
}
