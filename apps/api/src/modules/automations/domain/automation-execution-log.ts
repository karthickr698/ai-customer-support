import type { AutomationExecutionStatus } from '@ai-customer-support/contracts';
import { createAutomationExecutionLogId, type AutomationExecutionLogId, type AutomationJobId, type AutomationRuleId } from './ids.js';
import { parseExecutionStatus } from './values.js';

export type AutomationExecutionLogSnapshot = {
  readonly id: AutomationExecutionLogId;
  readonly organizationId: string;
  readonly jobId: AutomationJobId;
  readonly ruleId: AutomationRuleId;
  readonly attempt: number;
  readonly status: AutomationExecutionStatus;
  readonly message: string | undefined;
  readonly input: Record<string, unknown> | undefined;
  readonly output: Record<string, unknown> | undefined;
  readonly startedAt: Date;
  readonly finishedAt: Date | undefined;
};

export class AutomationExecutionLog {
  private constructor(
    readonly id: AutomationExecutionLogId,
    readonly organizationId: string,
    readonly jobId: AutomationJobId,
    readonly ruleId: AutomationRuleId,
    readonly attempt: number,
    private statusValue: AutomationExecutionStatus,
    private messageValue: string | undefined,
    readonly input: Record<string, unknown> | undefined,
    private outputValue: Record<string, unknown> | undefined,
    readonly startedAt: Date,
    private finishedAtValue: Date | undefined,
  ) {}

  static start(input: {
    readonly organizationId: string;
    readonly jobId: AutomationJobId;
    readonly ruleId: AutomationRuleId;
    readonly attempt: number;
    readonly now: Date;
    readonly payload?: Record<string, unknown>;
    readonly id?: AutomationExecutionLogId;
  }): AutomationExecutionLog {
    return new AutomationExecutionLog(
      input.id ?? createAutomationExecutionLogId(),
      input.organizationId,
      input.jobId,
      input.ruleId,
      input.attempt,
      'started',
      undefined,
      input.payload,
      undefined,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: AutomationExecutionLogSnapshot): AutomationExecutionLog {
    return new AutomationExecutionLog(
      snapshot.id,
      snapshot.organizationId,
      snapshot.jobId,
      snapshot.ruleId,
      snapshot.attempt,
      snapshot.status,
      snapshot.message,
      snapshot.input,
      snapshot.output,
      snapshot.startedAt,
      snapshot.finishedAt,
    );
  }

  get status(): AutomationExecutionStatus {
    return this.statusValue;
  }

  get message(): string | undefined {
    return this.messageValue;
  }

  get output(): Record<string, unknown> | undefined {
    return this.outputValue;
  }

  get finishedAt(): Date | undefined {
    return this.finishedAtValue;
  }

  finish(
    status: Exclude<AutomationExecutionStatus, 'started'>,
    now: Date,
    message?: string,
    output?: Record<string, unknown>,
  ): void {
    this.statusValue = parseExecutionStatus(status);
    this.messageValue = message?.slice(0, 2_000);
    this.outputValue = output;
    this.finishedAtValue = now;
  }

  toSnapshot(): AutomationExecutionLogSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      jobId: this.jobId,
      ruleId: this.ruleId,
      attempt: this.attempt,
      status: this.statusValue,
      message: this.messageValue,
      input: this.input,
      output: this.outputValue,
      startedAt: this.startedAt,
      finishedAt: this.finishedAtValue,
    };
  }
}
