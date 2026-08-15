import type { MessageFeedbackRating } from '@ai-customer-support/contracts';
import { InvalidMessageFeedbackError } from './errors.js';
import type { ConversationId } from './conversation-id.js';
import { createMessageFeedbackId, type MessageFeedbackId } from './message-feedback-id.js';
import type { MessageId } from './message-id.js';

export const MESSAGE_FEEDBACK_RATINGS = ['helpful', 'not_helpful'] as const;

export type MessageFeedbackSnapshot = {
  readonly id: MessageFeedbackId;
  readonly organizationId: string;
  readonly conversationId: ConversationId;
  readonly messageId: MessageId;
  readonly widgetSessionId: string;
  readonly rating: MessageFeedbackRating;
  readonly comment: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class MessageFeedback {
  private constructor(
    readonly id: MessageFeedbackId,
    readonly organizationId: string,
    readonly conversationId: ConversationId,
    readonly messageId: MessageId,
    readonly widgetSessionId: string,
    private ratingValue: MessageFeedbackRating,
    private commentValue: string | undefined,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly conversationId: ConversationId;
    readonly messageId: MessageId;
    readonly widgetSessionId: string;
    readonly rating: string;
    readonly comment?: string;
    readonly now: Date;
    readonly id?: MessageFeedbackId;
  }): MessageFeedback {
    return new MessageFeedback(
      input.id ?? createMessageFeedbackId(),
      input.organizationId,
      input.conversationId,
      input.messageId,
      input.widgetSessionId,
      parseMessageFeedbackRating(input.rating),
      normalizeComment(input.comment),
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: MessageFeedbackSnapshot): MessageFeedback {
    return new MessageFeedback(
      snapshot.id,
      snapshot.organizationId,
      snapshot.conversationId,
      snapshot.messageId,
      snapshot.widgetSessionId,
      snapshot.rating,
      snapshot.comment,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get rating(): MessageFeedbackRating {
    return this.ratingValue;
  }

  get comment(): string | undefined {
    return this.commentValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  ownedBySession(sessionId: string): boolean {
    return this.widgetSessionId === sessionId;
  }

  update(input: { readonly rating: string; readonly comment?: string; readonly now: Date }): void {
    this.ratingValue = parseMessageFeedbackRating(input.rating);
    this.commentValue = normalizeComment(input.comment);
    this.updatedAtValue = input.now;
  }

  toSnapshot(): MessageFeedbackSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      conversationId: this.conversationId,
      messageId: this.messageId,
      widgetSessionId: this.widgetSessionId,
      rating: this.ratingValue,
      comment: this.commentValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

export function isMessageFeedbackRating(value: string): value is MessageFeedbackRating {
  return (MESSAGE_FEEDBACK_RATINGS as readonly string[]).includes(value);
}

export function parseMessageFeedbackRating(value: string): MessageFeedbackRating {
  if (!isMessageFeedbackRating(value)) {
    throw new InvalidMessageFeedbackError('Feedback must be helpful or not helpful');
  }

  return value;
}

function normalizeComment(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const comment = raw.trim();
  if (comment.length === 0) {
    return undefined;
  }

  if (comment.length > 500) {
    throw new InvalidMessageFeedbackError('Feedback comment must be 500 characters or fewer');
  }

  return comment;
}
