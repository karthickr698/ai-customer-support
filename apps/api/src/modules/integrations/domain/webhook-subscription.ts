import {
  WEBHOOK_EVENT_NAMES,
  WEBHOOK_STATUSES,
  type WebhookEventName,
  type WebhookStatus,
} from '@ai-customer-support/contracts';
import type { EncryptedSecret } from './integration-credential.js';
import { InvalidWebhookSubscriptionError } from './errors.js';
import { createWebhookSubscriptionId, type WebhookSubscriptionId } from './ids.js';
import { assertSafeCallbackUrl } from './outbound-url.js';

const MAX_DESCRIPTION = 200;
const MAX_EVENTS = WEBHOOK_EVENT_NAMES.length;

export type WebhookSubscriptionSnapshot = {
  readonly id: WebhookSubscriptionId;
  readonly organizationId: string;
  readonly url: string;
  readonly description?: string;
  readonly events: readonly WebhookEventName[];
  readonly secret: EncryptedSecret;
  readonly secretLastFour: string;
  readonly status: WebhookStatus;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly disabledAt?: Date;
};

export class WebhookSubscription {
  private constructor(
    readonly id: WebhookSubscriptionId,
    readonly organizationId: string,
    readonly url: string,
    readonly description: string | undefined,
    readonly events: readonly WebhookEventName[],
    readonly secret: EncryptedSecret,
    readonly secretLastFour: string,
    readonly status: WebhookStatus,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly disabledAt: Date | undefined,
  ) {}

  get isActive(): boolean {
    return this.status === 'active';
  }

  static create(input: {
    readonly organizationId: string;
    readonly url: string;
    readonly events: readonly string[];
    readonly secret: EncryptedSecret;
    readonly plaintextSecret: string;
    readonly description?: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly allowLocalHttp?: boolean;
    readonly id?: WebhookSubscriptionId;
  }): WebhookSubscription {
    return new WebhookSubscription(
      input.id ?? createWebhookSubscriptionId(),
      input.organizationId,
      assertSafeCallbackUrl(input.url, 'Webhook URL', { allowLocalHttp: input.allowLocalHttp }),
      normalizeDescription(input.description),
      parseEvents(input.events),
      input.secret,
      lastFour(input.plaintextSecret),
      'active',
      input.createdByUserId,
      input.now,
      input.now,
      undefined,
    );
  }

  static reconstitute(snapshot: WebhookSubscriptionSnapshot): WebhookSubscription {
    return new WebhookSubscription(
      snapshot.id,
      snapshot.organizationId,
      snapshot.url,
      snapshot.description,
      snapshot.events,
      snapshot.secret,
      snapshot.secretLastFour,
      snapshot.status,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.disabledAt,
    );
  }

  accepts(eventName: WebhookEventName): boolean {
    return this.isActive && this.events.includes(eventName);
  }

  update(input: {
    readonly url?: string;
    readonly events?: readonly string[];
    readonly description?: string;
    readonly status?: Exclude<WebhookStatus, 'disabled'>;
    readonly now: Date;
    readonly allowLocalHttp?: boolean;
  }): WebhookSubscription {
    if (this.status === 'disabled') {
      throw new InvalidWebhookSubscriptionError('This webhook has been disabled');
    }
    const status = input.status ?? this.status;
    return new WebhookSubscription(
      this.id,
      this.organizationId,
      input.url !== undefined
        ? assertSafeCallbackUrl(input.url, 'Webhook URL', { allowLocalHttp: input.allowLocalHttp })
        : this.url,
      input.description !== undefined ? normalizeDescription(input.description) : this.description,
      input.events !== undefined ? parseEvents(input.events) : this.events,
      this.secret,
      this.secretLastFour,
      status,
      this.createdByUserId,
      this.createdAt,
      input.now,
      undefined,
    );
  }

  rotateSecret(input: {
    readonly secret: EncryptedSecret;
    readonly plaintextSecret: string;
    readonly now: Date;
  }): WebhookSubscription {
    if (this.status === 'disabled') {
      throw new InvalidWebhookSubscriptionError('This webhook has been disabled');
    }
    return new WebhookSubscription(
      this.id,
      this.organizationId,
      this.url,
      this.description,
      this.events,
      input.secret,
      lastFour(input.plaintextSecret),
      this.status,
      this.createdByUserId,
      this.createdAt,
      input.now,
      undefined,
    );
  }

  disable(now: Date): WebhookSubscription {
    if (this.status === 'disabled') {
      return this;
    }
    return new WebhookSubscription(
      this.id,
      this.organizationId,
      this.url,
      this.description,
      this.events,
      this.secret,
      this.secretLastFour,
      'disabled',
      this.createdByUserId,
      this.createdAt,
      now,
      now,
    );
  }

  toSnapshot(): WebhookSubscriptionSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      url: this.url,
      description: this.description,
      events: this.events,
      secret: this.secret,
      secretLastFour: this.secretLastFour,
      status: this.status,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      disabledAt: this.disabledAt,
    };
  }
}

function parseEvents(raw: readonly string[]): readonly WebhookEventName[] {
  const unique = [...new Set(raw.map((item) => item.trim()).filter((item) => item.length > 0))];
  if (unique.length === 0) {
    throw new InvalidWebhookSubscriptionError('Select at least one webhook event');
  }
  if (unique.length > MAX_EVENTS) {
    throw new InvalidWebhookSubscriptionError('Too many webhook events');
  }
  for (const eventName of unique) {
    if (!(WEBHOOK_EVENT_NAMES as readonly string[]).includes(eventName)) {
      throw new InvalidWebhookSubscriptionError(`Unknown webhook event: ${eventName}`);
    }
  }
  return unique as WebhookEventName[];
}

function normalizeDescription(raw: string | undefined): string | undefined {
  const description = raw?.trim();
  if (!description) {
    return undefined;
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new InvalidWebhookSubscriptionError(`Description must be at most ${MAX_DESCRIPTION} characters`);
  }
  return description;
}

function lastFour(secret: string): string {
  return secret.slice(-4);
}

export function parseWebhookStatus(value: string): WebhookStatus {
  if (!(WEBHOOK_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidWebhookSubscriptionError('Invalid webhook status');
  }
  return value as WebhookStatus;
}
