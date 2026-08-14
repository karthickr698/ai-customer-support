import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { MessageRepository } from '../../../application/ports/message-repository.js';
import { createConversationId, type ConversationId } from '../../../domain/conversation-id.js';
import { Message, parseMessageAuthorType, type MessageSnapshot } from '../../../domain/message.js';
import { createMessageId } from '../../../domain/message-id.js';

type MessageRecord = {
  id: string;
  conversationId: string;
  organizationId: string;
  authorType: string;
  authorId: string | null;
  body: string;
  createdAt: Date;
};

export class PostgresMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(message: Message): Promise<void> {
    const snapshot = message.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.message.create({ data });
  }

  async listByConversation(
    tenantId: string,
    conversationId: ConversationId,
    page: PageRequest,
  ): Promise<Page<Message>> {
    const where = { organizationId: tenantId, conversationId };
    const skip = (page.page - 1) * page.pageSize;

    const [total, records] = await this.prisma.$transaction([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: page.pageSize,
      }),
    ]);

    return {
      items: records.map(toMessage),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

function toMessage(record: MessageRecord): Message {
  const snapshot: MessageSnapshot = {
    id: createMessageId(record.id),
    conversationId: createConversationId(record.conversationId),
    organizationId: record.organizationId,
    authorType: parseMessageAuthorType(record.authorType),
    authorId: record.authorId ?? undefined,
    body: record.body,
    createdAt: record.createdAt,
  };

  return Message.reconstitute(snapshot);
}

function toRecord(snapshot: MessageSnapshot): Prisma.MessageUncheckedCreateInput {
  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId,
    organizationId: snapshot.organizationId,
    authorType: snapshot.authorType,
    authorId: snapshot.authorId ?? null,
    body: snapshot.body,
    createdAt: snapshot.createdAt,
  };
}
