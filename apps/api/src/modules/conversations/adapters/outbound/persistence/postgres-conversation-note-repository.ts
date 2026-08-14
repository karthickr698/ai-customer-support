import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ConversationNoteRepository } from '../../../application/ports/conversation-note-repository.js';
import { createConversationId, type ConversationId } from '../../../domain/conversation-id.js';
import {
  ConversationNote,
  type ConversationNoteSnapshot,
} from '../../../domain/conversation-note.js';
import { createConversationNoteId } from '../../../domain/conversation-note-id.js';

type NoteRecord = {
  id: string;
  conversationId: string;
  organizationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
};

export class PostgresConversationNoteRepository implements ConversationNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(note: ConversationNote): Promise<void> {
    const snapshot = note.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.conversationNote.create({ data });
  }

  async listByConversation(
    tenantId: string,
    conversationId: ConversationId,
    page: PageRequest,
  ): Promise<Page<ConversationNote>> {
    const where = { organizationId: tenantId, conversationId };
    const skip = (page.page - 1) * page.pageSize;

    const [total, records] = await this.prisma.$transaction([
      this.prisma.conversationNote.count({ where }),
      this.prisma.conversationNote.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: page.pageSize,
      }),
    ]);

    return {
      items: records.map(toNote),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

function toNote(record: NoteRecord): ConversationNote {
  const snapshot: ConversationNoteSnapshot = {
    id: createConversationNoteId(record.id),
    conversationId: createConversationId(record.conversationId),
    organizationId: record.organizationId,
    authorId: record.authorId,
    body: record.body,
    createdAt: record.createdAt,
  };

  return ConversationNote.reconstitute(snapshot);
}

function toRecord(snapshot: ConversationNoteSnapshot): Prisma.ConversationNoteUncheckedCreateInput {
  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId,
    organizationId: snapshot.organizationId,
    authorId: snapshot.authorId,
    body: snapshot.body,
    createdAt: snapshot.createdAt,
  };
}
