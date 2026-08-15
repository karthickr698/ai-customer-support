import type {
  NotificationChannel,
  NotificationEventType,
  NotificationRecipientType,
} from '@ai-customer-support/contracts';
import { InvalidNotificationError } from './errors.js';
import { createNotificationTemplateId, type NotificationTemplateId } from './ids.js';
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from './notification-policy.js';
import { assertSafeNotificationUrl } from './outbound-url.js';
import {
  channelMatchesRecipient,
  normalizeOptionalText,
  normalizeSlug,
  normalizeText,
  parseChannel,
  parseEventType,
  parseRecipientType,
  parseRetryPolicy,
} from './values.js';

export type NotificationTemplateSnapshot = {
  readonly id: NotificationTemplateId;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly subject: string | undefined;
  readonly body: string;
  readonly recipientType: NotificationRecipientType;
  readonly recipientField: string | undefined;
  readonly enabled: boolean;
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class NotificationTemplate {
  private constructor(
    readonly id: NotificationTemplateId,
    readonly organizationId: string,
    private nameValue: string,
    private slugValue: string,
    private channelValue: NotificationChannel,
    private eventTypeValue: NotificationEventType,
    private subjectValue: string | undefined,
    private bodyValue: string,
    private recipientTypeValue: NotificationRecipientType,
    private recipientFieldValue: string | undefined,
    private enabledValue: boolean,
    private maxAttemptsValue: number,
    private backoffMsValue: number,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly name: string;
    readonly slug: string;
    readonly channel: string;
    readonly eventType: string;
    readonly body: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly subject?: string;
    readonly recipientType: string;
    readonly recipientField?: string;
    readonly enabled?: boolean;
    readonly maxAttempts?: number;
    readonly backoffMs?: number;
    readonly allowLocalHttp?: boolean;
    readonly id?: NotificationTemplateId;
  }): NotificationTemplate {
    if (!input.organizationId.trim()) {
      throw new InvalidNotificationError('Organization is required');
    }
    const channel = parseChannel(input.channel);
    const recipientType = parseRecipientType(input.recipientType);
    assertChannelRecipient(channel, recipientType);
    const retry = parseRetryPolicy({ maxAttempts: input.maxAttempts, backoffMs: input.backoffMs });
    return new NotificationTemplate(
      input.id ?? createNotificationTemplateId(),
      input.organizationId,
      normalizeText(input.name, 'Name', 1, 80),
      normalizeSlug(input.slug),
      channel,
      parseEventType(input.eventType),
      normalizeOptionalText(input.subject, 'Subject', MAX_SUBJECT_LENGTH),
      normalizeText(input.body, 'Body', 1, MAX_BODY_LENGTH),
      recipientType,
      normalizeRecipientField(input.recipientField, recipientType, input.allowLocalHttp),
      input.enabled ?? true,
      retry.maxAttempts,
      retry.backoffMs,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: NotificationTemplateSnapshot): NotificationTemplate {
    return new NotificationTemplate(
      snapshot.id,
      snapshot.organizationId,
      snapshot.name,
      snapshot.slug,
      snapshot.channel,
      snapshot.eventType,
      snapshot.subject,
      snapshot.body,
      snapshot.recipientType,
      snapshot.recipientField,
      snapshot.enabled,
      snapshot.maxAttempts,
      snapshot.backoffMs,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this.nameValue;
  }

  get slug(): string {
    return this.slugValue;
  }

  get channel(): NotificationChannel {
    return this.channelValue;
  }

  get eventType(): NotificationEventType {
    return this.eventTypeValue;
  }

  get subject(): string | undefined {
    return this.subjectValue;
  }

  get body(): string {
    return this.bodyValue;
  }

  get recipientType(): NotificationRecipientType {
    return this.recipientTypeValue;
  }

  get recipientField(): string | undefined {
    return this.recipientFieldValue;
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  get maxAttempts(): number {
    return this.maxAttemptsValue;
  }

  get backoffMs(): number {
    return this.backoffMsValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  matchesEvent(eventName: string): boolean {
    return this.enabledValue && this.eventTypeValue === eventName;
  }

  update(
    input: {
      readonly name?: string;
      readonly slug?: string;
      readonly channel?: string;
      readonly eventType?: string;
      readonly subject?: string | null;
      readonly body?: string;
      readonly recipientType?: string;
      readonly recipientField?: string | null;
      readonly enabled?: boolean;
      readonly maxAttempts?: number;
      readonly backoffMs?: number;
      readonly allowLocalHttp?: boolean;
    },
    now: Date,
  ): void {
    if (input.name !== undefined) {
      this.nameValue = normalizeText(input.name, 'Name', 1, 80);
    }
    if (input.slug !== undefined) {
      this.slugValue = normalizeSlug(input.slug);
    }
    if (input.channel !== undefined) {
      this.channelValue = parseChannel(input.channel);
    }
    if (input.eventType !== undefined) {
      this.eventTypeValue = parseEventType(input.eventType);
    }
    if (input.subject !== undefined) {
      this.subjectValue = normalizeOptionalText(input.subject, 'Subject', MAX_SUBJECT_LENGTH);
    }
    if (input.body !== undefined) {
      this.bodyValue = normalizeText(input.body, 'Body', 1, MAX_BODY_LENGTH);
    }
    if (input.recipientType !== undefined) {
      this.recipientTypeValue = parseRecipientType(input.recipientType);
    }
    if (input.recipientField !== undefined) {
      this.recipientFieldValue = normalizeRecipientField(
        input.recipientField,
        this.recipientTypeValue,
        input.allowLocalHttp,
      );
    }
    if (input.enabled !== undefined) {
      this.enabledValue = input.enabled;
    }
    if (input.maxAttempts !== undefined || input.backoffMs !== undefined) {
      const retry = parseRetryPolicy({
        maxAttempts: input.maxAttempts ?? this.maxAttemptsValue,
        backoffMs: input.backoffMs ?? this.backoffMsValue,
      });
      this.maxAttemptsValue = retry.maxAttempts;
      this.backoffMsValue = retry.backoffMs;
    }
    assertChannelRecipient(this.channelValue, this.recipientTypeValue);
    this.updatedAtValue = now;
  }

  toSnapshot(): NotificationTemplateSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      name: this.nameValue,
      slug: this.slugValue,
      channel: this.channelValue,
      eventType: this.eventTypeValue,
      subject: this.subjectValue,
      body: this.bodyValue,
      recipientType: this.recipientTypeValue,
      recipientField: this.recipientFieldValue,
      enabled: this.enabledValue,
      maxAttempts: this.maxAttemptsValue,
      backoffMs: this.backoffMsValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function assertChannelRecipient(
  channel: NotificationChannel,
  recipientType: NotificationRecipientType,
): void {
  if (!channelMatchesRecipient(channel, recipientType)) {
    throw new InvalidNotificationError(`Channel ${channel} cannot use recipient type ${recipientType}`);
  }
}

function normalizeRecipientField(
  raw: string | null | undefined,
  recipientType: NotificationRecipientType,
  allowLocalHttp?: boolean,
): string | undefined {
  const field = normalizeOptionalText(raw, 'Recipient field', 200);
  if (!field) {
    return undefined;
  }
  if (recipientType === 'url' && field.includes('://')) {
    assertSafeNotificationUrl(field, 'Recipient field', { allowLocalHttp });
  }
  return field;
}
