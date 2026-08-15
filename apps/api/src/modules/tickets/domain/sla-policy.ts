import type { SlaPolicyPriority } from '@ai-customer-support/contracts';
import { InvalidTicketError } from './errors.js';
import { createTicketSlaPolicyId, type TicketSlaPolicyId } from './ids.js';
import { parseSlaMinutes } from './sla-timer.js';
import { normalizeText, parseSlaPolicyPriority } from './values.js';

export type TicketSlaPolicySnapshot = {
  readonly id: TicketSlaPolicyId;
  readonly organizationId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly appliesToPriority: SlaPolicyPriority;
  readonly firstResponseMinutes: number;
  readonly resolutionMinutes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class TicketSlaPolicy {
  private constructor(
    readonly id: TicketSlaPolicyId,
    readonly organizationId: string,
    private nameValue: string,
    private enabledValue: boolean,
    private appliesToPriorityValue: SlaPolicyPriority,
    private firstResponseMinutesValue: number,
    private resolutionMinutesValue: number,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly appliesToPriority: string;
    readonly firstResponseMinutes: number;
    readonly resolutionMinutes: number;
    readonly now: Date;
    readonly enabled?: boolean;
    readonly id?: TicketSlaPolicyId;
  }): TicketSlaPolicy {
    if (!input.organizationId.trim()) {
      throw new InvalidTicketError('Organization is required');
    }
    return new TicketSlaPolicy(
      input.id ?? createTicketSlaPolicyId(),
      input.organizationId,
      normalizeText(input.name, 'Name', 1, 80),
      input.enabled ?? true,
      parseSlaPolicyPriority(input.appliesToPriority),
      parseSlaMinutes(input.firstResponseMinutes, 'First response minutes'),
      parseSlaMinutes(input.resolutionMinutes, 'Resolution minutes'),
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: TicketSlaPolicySnapshot): TicketSlaPolicy {
    return new TicketSlaPolicy(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.enabled,
      snapshot.appliesToPriority,
      snapshot.firstResponseMinutes,
      snapshot.resolutionMinutes,
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

  get appliesToPriority(): SlaPolicyPriority {
    return this.appliesToPriorityValue;
  }

  get firstResponseMinutes(): number {
    return this.firstResponseMinutesValue;
  }

  get resolutionMinutes(): number {
    return this.resolutionMinutesValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  matchesPriority(priority: string): boolean {
    return this.enabledValue && (this.appliesToPriorityValue === 'any' || this.appliesToPriorityValue === priority);
  }

  update(
    input: {
      readonly name?: string;
      readonly enabled?: boolean;
      readonly appliesToPriority?: string;
      readonly firstResponseMinutes?: number;
      readonly resolutionMinutes?: number;
    },
    now: Date,
  ): void {
    if (input.name !== undefined) {
      this.nameValue = normalizeText(input.name, 'Name', 1, 80);
    }
    if (input.enabled !== undefined) {
      this.enabledValue = input.enabled;
    }
    if (input.appliesToPriority !== undefined) {
      this.appliesToPriorityValue = parseSlaPolicyPriority(input.appliesToPriority);
    }
    if (input.firstResponseMinutes !== undefined) {
      this.firstResponseMinutesValue = parseSlaMinutes(input.firstResponseMinutes, 'First response minutes');
    }
    if (input.resolutionMinutes !== undefined) {
      this.resolutionMinutesValue = parseSlaMinutes(input.resolutionMinutes, 'Resolution minutes');
    }
    this.updatedAtValue = now;
  }

  toSnapshot(): TicketSlaPolicySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.nameValue,
      enabled: this.enabledValue,
      appliesToPriority: this.appliesToPriorityValue,
      firstResponseMinutes: this.firstResponseMinutesValue,
      resolutionMinutes: this.resolutionMinutesValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export function selectSlaPolicy(
  policies: readonly TicketSlaPolicy[],
  priority: string,
): TicketSlaPolicy | undefined {
  const enabled = policies.filter((policy) => policy.matchesPriority(priority));
  return (
    enabled.find((policy) => policy.appliesToPriority === priority) ??
    enabled.find((policy) => policy.appliesToPriority === 'any')
  );
}
