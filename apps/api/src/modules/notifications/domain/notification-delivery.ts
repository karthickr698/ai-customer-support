import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationProviderName,
  NotificationRecipientType,
  NotificationTriggerKind,
} from '@ai-customer-support/contracts';
import { InvalidNotificationError, InvalidNotificationStateError } from './errors.js';
import {
  createNotificationDeliveryId,
  type NotificationDeliveryId,
  type NotificationTemplateId,
} from './ids.js';
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from './notification-policy.js';
import { assertSafeNotificationUrl } from './outbound-url.js';
import {
  channelMatchesRecipient,
  jsonRecord,
  normalizeOptionalText,
  normalizeRecipient,
  normalizeText,
  parseChannel,
  parseDeliveryStatus,
  parseEventType,
  parseProviderName,
  parseRecipientType,
  parseRetryPolicy,
  parseTriggerKind,
  retryDelayMs,
} from './values.js';

export type NotificationDeliverySnapshot = {
  readonly id: NotificationDeliveryId;
  readonly organizationId: string;
  readonly templateId: NotificationTemplateId | undefined;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly eventId: string | undefined;
  readonly triggerKind: NotificationTriggerKind;
  readonly idempotencyKey: string;
  readonly recipientType: NotificationRecipientType;
  readonly recipient: string;
  readonly subject: string | undefined;
  readonly body: string;
  readonly payload: Record<string, unknown>;
  readonly status: NotificationDeliveryStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly runAfter: Date;
  readonly lastError: string | undefined;
  readonly provider: NotificationProviderName | undefined;
  readonly providerMessageId: string | undefined;
  readonly claimedAt: Date | undefined;
  readonly deliveredAt: Date | undefined;
  readonly completedAt: Date | undefined;
  readonly createdByUserId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class NotificationDelivery {
  private constructor(
    readonly id: NotificationDeliveryId,
    readonly organizationId: string,
    readonly templateId: NotificationTemplateId | undefined,
    readonly channel: NotificationChannel,
    readonly eventType: NotificationEventType,
    readonly eventId: string | undefined,
    readonly triggerKind: NotificationTriggerKind,
    readonly idempotencyKey: string,
    readonly recipientType: NotificationRecipientType,
    readonly recipient: string,
    readonly subject: string | undefined,
    readonly body: string,
    readonly payload: Record<string, unknown>,
    private statusValue: NotificationDeliveryStatus,
    private attemptValue: number,
    readonly maxAttempts: number,
    private runAfterValue: Date,
    private lastErrorValue: string | undefined,
    private providerValue: NotificationProviderName | undefined,
    private providerMessageIdValue: string | undefined,
    private claimedAtValue: Date | undefined,
    private deliveredAtValue: Date | undefined,
    private completedAtValue: Date | undefined,
    readonly createdByUserId: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly channel: string;
    readonly eventType: string;
    readonly triggerKind: string;
    readonly idempotencyKey: string;
    readonly recipientType: string;
    readonly recipient: string;
    readonly body: string;
    readonly now: Date;
    readonly templateId?: NotificationTemplateId;
    readonly eventId?: string;
    readonly subject?: string;
    readonly payload?: Record<string, unknown>;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly createdByUserId?: string;
    readonly allowLocalHttp?: boolean;
    readonly id?: NotificationDeliveryId;
  }): NotificationDelivery {
    if (!input.organizationId.trim()) {
      throw new InvalidNotificationError('Organization is required');
    }
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 300) {
      throw new InvalidNotificationError('Idempotency key is required');
    }
    const channel = parseChannel(input.channel);
    const recipientType = parseRecipientType(input.recipientType);
    if (!channelMatchesRecipient(channel, recipientType)) {
      throw new InvalidNotificationError(`Channel ${channel} cannot use recipient type ${recipientType}`);
    }
    const recipient = normalizeRecipient(recipientType, input.recipient);
    if (recipientType === 'url') {
      assertSafeNotificationUrl(recipient, 'Recipient URL', { allowLocalHttp: input.allowLocalHttp });
    }
    const retry = parseRetryPolicy({ maxAttempts: input.maxAttempts, backoffMs: input.backoffMs });
    return new NotificationDelivery(
      input.id ?? createNotificationDeliveryId(),
      input.organizationId,
      input.templateId,
      channel,
      parseEventType(input.eventType),
      input.eventId,
      parseTriggerKind(input.triggerKind),
      input.idempotencyKey.trim(),
      recipientType,
      recipient,
      normalizeOptionalText(input.subject, 'Subject', MAX_SUBJECT_LENGTH),
      normalizeText(input.body, 'Body', 1, MAX_BODY_LENGTH),
      input.payload ?? {},
      'pending',
      0,
      retry.maxAttempts,
      input.now,
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

  static reconstitute(snapshot: NotificationDeliverySnapshot): NotificationDelivery {
    return new NotificationDelivery(
      snapshot.id,
      snapshot.organizationId,
      snapshot.templateId,
      snapshot.channel,
      snapshot.eventType,
      snapshot.eventId,
      snapshot.triggerKind,
      snapshot.idempotencyKey,
      snapshot.recipientType,
      snapshot.recipient,
      snapshot.subject,
      snapshot.body,
      snapshot.payload,
      snapshot.status,
      snapshot.attempt,
      snapshot.maxAttempts,
      snapshot.runAfter,
      snapshot.lastError,
      snapshot.provider,
      snapshot.providerMessageId,
      snapshot.claimedAt,
      snapshot.deliveredAt,
      snapshot.completedAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): NotificationDeliveryStatus {
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

  get provider(): NotificationProviderName | undefined {
    return this.providerValue;
  }

  get providerMessageId(): string | undefined {
    return this.providerMessageIdValue;
  }

  get claimedAt(): Date | undefined {
    return this.claimedAtValue;
  }

  get deliveredAt(): Date | undefined {
    return this.deliveredAtValue;
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
    return (
      this.statusValue === 'delivered' || this.statusValue === 'skipped' || this.statusValue === 'dead'
    );
  }

  applyClaim(attempt: number, claimedAt: Date): void {
    this.statusValue = 'sending';
    this.attemptValue = attempt;
    this.claimedAtValue = claimedAt;
    this.updatedAtValue = claimedAt;
  }

  markDelivered(input: {
    readonly now: Date;
    readonly provider: string;
    readonly providerMessageId?: string;
  }): void {
    if (this.statusValue !== 'sending') {
      throw new InvalidNotificationStateError('Only a sending delivery can be marked delivered');
    }
    this.statusValue = 'delivered';
    this.providerValue = parseProviderName(input.provider);
    this.providerMessageIdValue = input.providerMessageId;
    this.lastErrorValue = undefined;
    this.deliveredAtValue = input.now;
    this.completedAtValue = input.now;
    this.updatedAtValue = input.now;
  }

  markSkipped(now: Date, reason: string): void {
    this.statusValue = 'skipped';
    this.lastErrorValue = reason.slice(0, 2_000);
    this.completedAtValue = now;
    this.updatedAtValue = now;
  }

  markFailed(input: {
    readonly now: Date;
    readonly error: string;
    readonly backoffMs: number;
    readonly provider?: string;
  }): void {
    if (this.statusValue !== 'sending') {
      throw new InvalidNotificationStateError('Only a sending delivery can fail');
    }
    this.lastErrorValue = input.error.slice(0, 2_000);
    this.providerValue = parseProviderName(input.provider);
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
      throw new InvalidNotificationStateError('Only a dead or skipped delivery can be retried');
    }
    this.statusValue = 'pending';
    this.runAfterValue = now;
    this.completedAtValue = undefined;
    this.claimedAtValue = undefined;
    this.lastErrorValue = undefined;
    this.updatedAtValue = now;
  }

  toSnapshot(): NotificationDeliverySnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      templateId: this.templateId,
      channel: this.channel,
      eventType: this.eventType,
      eventId: this.eventId,
      triggerKind: this.triggerKind,
      idempotencyKey: this.idempotencyKey,
      recipientType: this.recipientType,
      recipient: this.recipient,
      subject: this.subject,
      body: this.body,
      payload: this.payload,
      status: parseDeliveryStatus(this.statusValue),
      attempt: this.attemptValue,
      maxAttempts: this.maxAttempts,
      runAfter: this.runAfterValue,
      lastError: this.lastErrorValue,
      provider: this.providerValue,
      providerMessageId: this.providerMessageIdValue,
      claimedAt: this.claimedAtValue,
      deliveredAt: this.deliveredAtValue,
      completedAt: this.completedAtValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export function eventIdempotencyKey(
  tenantId: string,
  templateId: string,
  eventId: string,
  recipient: string,
): string {
  return `evt:${tenantId}:${templateId}:${eventId}:${recipient}`.slice(0, 300);
}

export function manualIdempotencyKey(
  tenantId: string,
  templateKey: string,
  recipient: string,
  key: string,
): string {
  return `man:${tenantId}:${templateKey}:${recipient}:${key}`.slice(0, 300);
}

export function payloadRecord(value: unknown): Record<string, unknown> {
  return jsonRecord(value);
}
