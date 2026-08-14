import { InvalidMessageAuthorTypeError, InvalidMessageBodyError } from './errors.js';
import { createMessageId, type MessageId } from './message-id.js';
import type { ConversationId } from './conversation-id.js';

export const MESSAGE_AUTHOR_TYPES = ['customer', 'agent', 'system', 'ai'] as const;
export type MessageAuthorType = (typeof MESSAGE_AUTHOR_TYPES)[number];

export type MessageSnapshot = {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly organizationId: string;
  readonly authorType: MessageAuthorType;
  readonly authorId: string | undefined;
  readonly body: string;
  readonly createdAt: Date;
};

export class Message {
  private constructor(
    readonly id: MessageId,
    readonly conversationId: ConversationId,
    readonly organizationId: string,
    readonly authorType: MessageAuthorType,
    readonly authorId: string | undefined,
    readonly body: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly conversationId: ConversationId;
    readonly organizationId: string;
    readonly authorType: MessageAuthorType;
    readonly authorId?: string;
    readonly body: string;
    readonly now: Date;
    readonly id?: MessageId;
  }): Message {
    if (!isMessageAuthorType(input.authorType)) {
      throw new InvalidMessageAuthorTypeError();
    }

    return new Message(
      input.id ?? createMessageId(),
      input.conversationId,
      input.organizationId,
      input.authorType,
      input.authorId,
      normalizeMessageBody(input.body),
      input.now,
    );
  }

  static reconstitute(snapshot: MessageSnapshot): Message {
    return new Message(
      snapshot.id,
      snapshot.conversationId,
      snapshot.organizationId,
      snapshot.authorType,
      snapshot.authorId,
      snapshot.body,
      snapshot.createdAt,
    );
  }

  toSnapshot(): MessageSnapshot {
    return {
      id: this.id,
      conversationId: this.conversationId,
      organizationId: this.organizationId,
      authorType: this.authorType,
      authorId: this.authorId,
      body: this.body,
      createdAt: this.createdAt,
    };
  }

  preview(maxLength = 240): string {
    if (this.body.length <= maxLength) {
      return this.body;
    }

    return `${this.body.slice(0, maxLength - 1).trimEnd()}…`;
  }
}

export function isMessageAuthorType(value: string): value is MessageAuthorType {
  return (MESSAGE_AUTHOR_TYPES as readonly string[]).includes(value);
}

export function parseMessageAuthorType(value: string): MessageAuthorType {
  if (!isMessageAuthorType(value)) {
    throw new InvalidMessageAuthorTypeError();
  }

  return value;
}

function normalizeMessageBody(raw: string): string {
  const body = raw.trim();
  if (body.length < 1 || body.length > 10_000) {
    throw new InvalidMessageBodyError();
  }

  return body;
}
