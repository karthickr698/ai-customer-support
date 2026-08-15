import type { Prisma, PrismaClient } from '@prisma/client';
import type { MessageFeedbackRepository } from '../../../application/ports/message-feedback-repository.js';
import { createConversationId, type ConversationId } from '../../../domain/conversation-id.js';
import {
  MessageFeedback,
  parseMessageFeedbackRating,
  type MessageFeedbackSnapshot,
} from '../../../domain/message-feedback.js';
import { createMessageFeedbackId } from '../../../domain/message-feedback-id.js';
import { createMessageId, type MessageId } from '../../../domain/message-id.js';

type FeedbackRecord = {
  id: string;
  organizationId: string;
  conversationId: string;
  messageId: string;
  widgetSessionId: string;
  rating: string;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresMessageFeedbackRepository implements MessageFeedbackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(feedback: MessageFeedback): Promise<void> {
    const snapshot = feedback.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.messageFeedback.upsert({
      where: {
        widgetSessionId_messageId: {
          widgetSessionId: snapshot.widgetSessionId,
          messageId: snapshot.messageId,
        },
      },
      create: data,
      update: {
        rating: data.rating,
        comment: data.comment,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findBySessionAndMessage(
    tenantId: string,
    sessionId: string,
    messageId: MessageId,
  ): Promise<MessageFeedback | null> {
    const record = await this.prisma.messageFeedback.findFirst({
      where: { organizationId: tenantId, widgetSessionId: sessionId, messageId },
    });
    return record ? toFeedback(record) : null;
  }

  async listBySessionAndMessageIds(
    tenantId: string,
    sessionId: string,
    messageIds: readonly MessageId[],
  ): Promise<MessageFeedback[]> {
    if (messageIds.length === 0) {
      return [];
    }

    const records = await this.prisma.messageFeedback.findMany({
      where: {
        organizationId: tenantId,
        widgetSessionId: sessionId,
        messageId: { in: [...messageIds] },
      },
    });
    return records.map(toFeedback);
  }

  async listByConversation(
    tenantId: string,
    conversationId: ConversationId,
  ): Promise<MessageFeedback[]> {
    const records = await this.prisma.messageFeedback.findMany({
      where: { organizationId: tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toFeedback);
  }
}

function toFeedback(record: FeedbackRecord): MessageFeedback {
  const snapshot: MessageFeedbackSnapshot = {
    id: createMessageFeedbackId(record.id),
    organizationId: record.organizationId,
    conversationId: createConversationId(record.conversationId),
    messageId: createMessageId(record.messageId),
    widgetSessionId: record.widgetSessionId,
    rating: parseMessageFeedbackRating(record.rating),
    comment: record.comment ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return MessageFeedback.reconstitute(snapshot);
}

function toRecord(snapshot: MessageFeedbackSnapshot): Prisma.MessageFeedbackUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    conversationId: snapshot.conversationId,
    messageId: snapshot.messageId,
    widgetSessionId: snapshot.widgetSessionId,
    rating: snapshot.rating,
    comment: snapshot.comment ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
