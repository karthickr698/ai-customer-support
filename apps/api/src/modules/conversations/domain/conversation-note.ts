import { InvalidConversationNoteError } from './errors.js';
import { createConversationNoteId, type ConversationNoteId } from './conversation-note-id.js';
import type { ConversationId } from './conversation-id.js';

export type ConversationNoteSnapshot = {
  readonly id: ConversationNoteId;
  readonly conversationId: ConversationId;
  readonly organizationId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
};

export class ConversationNote {
  private constructor(
    readonly id: ConversationNoteId,
    readonly conversationId: ConversationId,
    readonly organizationId: string,
    readonly authorId: string,
    readonly body: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly conversationId: ConversationId;
    readonly organizationId: string;
    readonly authorId: string;
    readonly body: string;
    readonly now: Date;
    readonly id?: ConversationNoteId;
  }): ConversationNote {
    return new ConversationNote(
      input.id ?? createConversationNoteId(),
      input.conversationId,
      input.organizationId,
      input.authorId,
      normalizeNoteBody(input.body),
      input.now,
    );
  }

  static reconstitute(snapshot: ConversationNoteSnapshot): ConversationNote {
    return new ConversationNote(
      snapshot.id,
      snapshot.conversationId,
      snapshot.organizationId,
      snapshot.authorId,
      snapshot.body,
      snapshot.createdAt,
    );
  }

  toSnapshot(): ConversationNoteSnapshot {
    return {
      id: this.id,
      conversationId: this.conversationId,
      organizationId: this.organizationId,
      authorId: this.authorId,
      body: this.body,
      createdAt: this.createdAt,
    };
  }
}

function normalizeNoteBody(raw: string): string {
  const body = raw.trim();
  if (body.length < 1 || body.length > 5000) {
    throw new InvalidConversationNoteError();
  }

  return body;
}
