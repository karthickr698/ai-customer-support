import type { NotificationAttemptStatus, NotificationProviderName } from '@ai-customer-support/contracts';
import { createNotificationAttemptId, type NotificationAttemptId, type NotificationDeliveryId } from './ids.js';
import { MAX_LOG_MESSAGE } from './notification-policy.js';
import { parseAttemptStatus, parseProviderName } from './values.js';

export type NotificationAttemptSnapshot = {
  readonly id: NotificationAttemptId;
  readonly organizationId: string;
  readonly deliveryId: NotificationDeliveryId;
  readonly attempt: number;
  readonly status: NotificationAttemptStatus;
  readonly provider: NotificationProviderName | undefined;
  readonly providerMessageId: string | undefined;
  readonly message: string | undefined;
  readonly startedAt: Date;
  readonly finishedAt: Date | undefined;
};

export class NotificationDeliveryAttempt {
  private constructor(
    readonly id: NotificationAttemptId,
    readonly organizationId: string,
    readonly deliveryId: NotificationDeliveryId,
    readonly attempt: number,
    private statusValue: NotificationAttemptStatus,
    private providerValue: NotificationProviderName | undefined,
    private providerMessageIdValue: string | undefined,
    private messageValue: string | undefined,
    readonly startedAt: Date,
    private finishedAtValue: Date | undefined,
  ) {}

  static start(input: {
    readonly organizationId: string;
    readonly deliveryId: NotificationDeliveryId;
    readonly attempt: number;
    readonly now: Date;
    readonly id?: NotificationAttemptId;
  }): NotificationDeliveryAttempt {
    return new NotificationDeliveryAttempt(
      input.id ?? createNotificationAttemptId(),
      input.organizationId,
      input.deliveryId,
      input.attempt,
      'started',
      undefined,
      undefined,
      undefined,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: NotificationAttemptSnapshot): NotificationDeliveryAttempt {
    return new NotificationDeliveryAttempt(
      snapshot.id,
      snapshot.organizationId,
      snapshot.deliveryId,
      snapshot.attempt,
      snapshot.status,
      snapshot.provider,
      snapshot.providerMessageId,
      snapshot.message,
      snapshot.startedAt,
      snapshot.finishedAt,
    );
  }

  get status(): NotificationAttemptStatus {
    return this.statusValue;
  }

  get provider(): NotificationProviderName | undefined {
    return this.providerValue;
  }

  get providerMessageId(): string | undefined {
    return this.providerMessageIdValue;
  }

  get message(): string | undefined {
    return this.messageValue;
  }

  get finishedAt(): Date | undefined {
    return this.finishedAtValue;
  }

  finish(input: {
    readonly status: Exclude<NotificationAttemptStatus, 'started'>;
    readonly now: Date;
    readonly provider?: string;
    readonly providerMessageId?: string;
    readonly message?: string;
  }): void {
    this.statusValue = input.status;
    this.providerValue = parseProviderName(input.provider);
    this.providerMessageIdValue = input.providerMessageId;
    this.messageValue = input.message?.slice(0, MAX_LOG_MESSAGE);
    this.finishedAtValue = input.now;
  }

  toSnapshot(): NotificationAttemptSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      deliveryId: this.deliveryId,
      attempt: this.attempt,
      status: parseAttemptStatus(this.statusValue),
      provider: this.providerValue,
      providerMessageId: this.providerMessageIdValue,
      message: this.messageValue,
      startedAt: this.startedAt,
      finishedAt: this.finishedAtValue,
    };
  }
}
