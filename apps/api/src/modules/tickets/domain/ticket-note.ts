import { InvalidTicketError } from './errors.js';
import { createTicketNoteId, type TicketId, type TicketNoteId } from './ids.js';
import { normalizeText } from './values.js';

export type TicketNoteSnapshot = {
  readonly id: TicketNoteId;
  readonly ticketId: TicketId;
  readonly organizationId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
};

export class TicketNote {
  private constructor(
    readonly id: TicketNoteId,
    readonly ticketId: TicketId,
    readonly organizationId: string,
    readonly authorId: string,
    readonly body: string,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly ticketId: TicketId;
    readonly organizationId: string;
    readonly authorId: string;
    readonly body: string;
    readonly now: Date;
    readonly id?: TicketNoteId;
  }): TicketNote {
    return new TicketNote(
      input.id ?? createTicketNoteId(),
      input.ticketId,
      input.organizationId,
      input.authorId,
      normalizeText(input.body, 'Note', 1, 4_000),
      input.now,
    );
  }

  static reconstitute(snapshot: TicketNoteSnapshot): TicketNote {
    return new TicketNote(
      snapshot.id,
      snapshot.ticketId,
      snapshot.organizationId,
      snapshot.authorId,
      snapshot.body,
      snapshot.createdAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): TicketNoteSnapshot {
    return {
      id: this.id,
      ticketId: this.ticketId,
      organizationId: this.organizationId,
      authorId: this.authorId,
      body: this.body,
      createdAt: this.createdAt,
    };
  }
}

export function assertNoteAuthor(authorId: string): void {
  if (!authorId.trim()) {
    throw new InvalidTicketError('Note author is required');
  }
}
