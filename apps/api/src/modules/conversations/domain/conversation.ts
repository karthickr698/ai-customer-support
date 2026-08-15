import {
  ConversationClosedError,
  ConversationTagAlreadyExistsError,
  ConversationTagNotFoundError,
  InvalidConversationStateError,
  InvalidConversationSubjectError,
  TooManyConversationTagsError,
  UnauthorizedConversationAccessError,
} from './errors.js';
import { parseConversationChannel, type ConversationChannel } from './conversation-channel.js';
import { createConversationId, type ConversationId } from './conversation-id.js';
import {
  parseConversationPriority,
  type ConversationPriority,
} from './conversation-priority.js';
import {
  assertStatusTransition,
  canEscalateFrom,
  parseConversationStatus,
  type ConversationStatus,
} from './conversation-status.js';
import { ConversationTag } from './conversation-tag.js';
import { CustomerContact } from './customer-contact.js';
import type { Message, MessageAuthorType } from './message.js';

const MAX_TAGS = 20;

export type ConversationSnapshot = {
  readonly id: ConversationId;
  readonly organizationId: string;
  readonly customerId: string | undefined;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly subject: string | undefined;
  readonly status: ConversationStatus;
  readonly priority: ConversationPriority;
  readonly assignedAgentId: string | undefined;
  readonly channel: ConversationChannel;
  readonly widgetSessionId: string | undefined;
  readonly tags: readonly string[];
  readonly lastMessageAt: Date | undefined;
  readonly lastMessagePreview: string | undefined;
  readonly lastMessageAuthorType: MessageAuthorType | undefined;
  readonly createdByUserId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Conversation {
  private constructor(
    readonly id: ConversationId,
    readonly organizationId: string,
    private customerValue: CustomerContact,
    private subjectValue: string | undefined,
    private statusValue: ConversationStatus,
    private priorityValue: ConversationPriority,
    private assignedAgentIdValue: string | undefined,
    private channelValue: ConversationChannel,
    private widgetSessionIdValue: string | undefined,
    private tagsValue: ConversationTag[],
    private lastMessageAtValue: Date | undefined,
    private lastMessagePreviewValue: string | undefined,
    private lastMessageAuthorTypeValue: MessageAuthorType | undefined,
    readonly createdByUserId: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly customer: CustomerContact;
    readonly now: Date;
    readonly subject?: string;
    readonly channel?: string;
    readonly priority?: string;
    readonly widgetSessionId?: string;
    readonly createdByUserId?: string;
    readonly id?: ConversationId;
  }): Conversation {
    return new Conversation(
      input.id ?? createConversationId(),
      input.organizationId,
      input.customer,
      normalizeSubject(input.subject),
      'open',
      parseConversationPriority(input.priority),
      undefined,
      parseConversationChannel(input.channel ?? 'web'),
      input.widgetSessionId,
      [],
      undefined,
      undefined,
      undefined,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: ConversationSnapshot): Conversation {
    return new Conversation(
      snapshot.id,
      snapshot.organizationId,
      CustomerContact.parse({
        email: snapshot.customerEmail,
        name: snapshot.customerName,
        customerId: snapshot.customerId,
      }),
      snapshot.subject,
      parseConversationStatus(snapshot.status),
      parseConversationPriority(snapshot.priority),
      snapshot.assignedAgentId,
      parseConversationChannel(snapshot.channel),
      snapshot.widgetSessionId,
      snapshot.tags.map((tag) => ConversationTag.parse(tag)),
      snapshot.lastMessageAt,
      snapshot.lastMessagePreview,
      snapshot.lastMessageAuthorType,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get customer(): CustomerContact {
    return this.customerValue;
  }

  get subject(): string | undefined {
    return this.subjectValue;
  }

  get status(): ConversationStatus {
    return this.statusValue;
  }

  get priority(): ConversationPriority {
    return this.priorityValue;
  }

  get assignedAgentId(): string | undefined {
    return this.assignedAgentIdValue;
  }

  get channel(): ConversationChannel {
    return this.channelValue;
  }

  get widgetSessionId(): string | undefined {
    return this.widgetSessionIdValue;
  }

  get tags(): readonly ConversationTag[] {
    return this.tagsValue;
  }

  get lastMessageAt(): Date | undefined {
    return this.lastMessageAtValue;
  }

  get lastMessagePreview(): string | undefined {
    return this.lastMessagePreviewValue;
  }

  get lastMessageAuthorType(): MessageAuthorType | undefined {
    return this.lastMessageAuthorTypeValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isClosed(): boolean {
    return this.statusValue === 'closed';
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  assertOwnedByWidgetSession(sessionId: string): void {
    if (this.widgetSessionIdValue !== sessionId) {
      throw new UnauthorizedConversationAccessError();
    }
  }

  assertCanAcceptMessage(): void {
    if (this.isClosed) {
      throw new ConversationClosedError();
    }
  }

  canGenerateAiReply(): boolean {
    return this.statusValue === 'open' || this.statusValue === 'pending';
  }

  identifyCustomer(customer: CustomerContact, now: Date): void {
    this.customerValue = customer;
    this.updatedAtValue = now;
  }

  transitionTo(status: ConversationStatus, now: Date): void {
    assertStatusTransition(this.statusValue, status);
    this.statusValue = status;
    this.updatedAtValue = now;
  }

  escalate(now: Date): void {
    if (!canEscalateFrom(this.statusValue)) {
      throw new InvalidConversationStateError(
        `Cannot escalate a conversation that is ${this.statusValue}`,
      );
    }

    this.transitionTo('escalated', now);
  }

  changePriority(priority: ConversationPriority, now: Date): void {
    if (this.priorityValue === priority) {
      return;
    }

    this.priorityValue = priority;
    this.updatedAtValue = now;
  }

  assignTo(agentId: string, now: Date): void {
    this.assignedAgentIdValue = agentId;
    this.updatedAtValue = now;
  }

  unassign(now: Date): void {
    this.assignedAgentIdValue = undefined;
    this.updatedAtValue = now;
  }

  addTag(tag: ConversationTag, now: Date): void {
    if (this.tagsValue.some((existing) => existing.value === tag.value)) {
      throw new ConversationTagAlreadyExistsError();
    }

    if (this.tagsValue.length >= MAX_TAGS) {
      throw new TooManyConversationTagsError();
    }

    this.tagsValue = [...this.tagsValue, tag];
    this.updatedAtValue = now;
  }

  removeTag(tag: ConversationTag, now: Date): void {
    const next = this.tagsValue.filter((existing) => existing.value !== tag.value);
    if (next.length === this.tagsValue.length) {
      throw new ConversationTagNotFoundError();
    }

    this.tagsValue = next;
    this.updatedAtValue = now;
  }

  recordMessage(message: Message, now: Date): void {
    this.assertCanAcceptMessage();
    this.lastMessageAtValue = message.createdAt;
    this.lastMessagePreviewValue = message.preview();
    this.lastMessageAuthorTypeValue = message.authorType;
    this.updatedAtValue = now;
  }

  toSnapshot(): ConversationSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      customerId: this.customerValue.customerId,
      customerEmail: this.customerValue.email,
      customerName: this.customerValue.name,
      subject: this.subjectValue,
      status: this.statusValue,
      priority: this.priorityValue,
      assignedAgentId: this.assignedAgentIdValue,
      channel: this.channelValue,
      widgetSessionId: this.widgetSessionIdValue,
      tags: this.tagsValue.map((tag) => tag.value),
      lastMessageAt: this.lastMessageAtValue,
      lastMessagePreview: this.lastMessagePreviewValue,
      lastMessageAuthorType: this.lastMessageAuthorTypeValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function normalizeSubject(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const subject = raw.trim();
  if (subject.length === 0) {
    return undefined;
  }

  if (subject.length > 200) {
    throw new InvalidConversationSubjectError();
  }

  return subject;
}
