import type { Prisma, PrismaClient } from '@prisma/client';
import type { MessageAttachmentRepository } from '../../../application/ports/message-attachment-repository.js';
import { createConversationId, type ConversationId } from '../../../domain/conversation-id.js';
import {
  MessageAttachment,
  parseAllowedAttachmentContentType,
  type MessageAttachmentSnapshot,
} from '../../../domain/message-attachment.js';
import {
  createMessageAttachmentId,
  type MessageAttachmentId,
} from '../../../domain/message-attachment-id.js';
import { createMessageId, type MessageId } from '../../../domain/message-id.js';

type AttachmentRecord = {
  id: string;
  organizationId: string;
  conversationId: string;
  messageId: string | null;
  widgetSessionId: string | null;
  fileName: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  createdAt: Date;
};

export class PostgresMessageAttachmentRepository implements MessageAttachmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(attachment: MessageAttachment): Promise<void> {
    const snapshot = attachment.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.messageAttachment.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        messageId: data.messageId,
        fileName: data.fileName,
        contentType: data.contentType,
        byteSize: data.byteSize,
        storageKey: data.storageKey,
      },
    });
  }

  async findById(
    tenantId: string,
    attachmentId: MessageAttachmentId,
  ): Promise<MessageAttachment | null> {
    const record = await this.prisma.messageAttachment.findFirst({
      where: { id: attachmentId, organizationId: tenantId },
    });
    return record ? toAttachment(record) : null;
  }

  async listByConversation(
    tenantId: string,
    conversationId: ConversationId,
  ): Promise<MessageAttachment[]> {
    const records = await this.prisma.messageAttachment.findMany({
      where: { organizationId: tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toAttachment);
  }

  async listByMessageIds(
    tenantId: string,
    messageIds: readonly MessageId[],
  ): Promise<MessageAttachment[]> {
    if (messageIds.length === 0) {
      return [];
    }

    const records = await this.prisma.messageAttachment.findMany({
      where: { organizationId: tenantId, messageId: { in: [...messageIds] } },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toAttachment);
  }

  async listByIds(
    tenantId: string,
    conversationId: ConversationId,
    attachmentIds: readonly MessageAttachmentId[],
  ): Promise<MessageAttachment[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    const records = await this.prisma.messageAttachment.findMany({
      where: {
        organizationId: tenantId,
        conversationId,
        id: { in: [...attachmentIds] },
      },
    });
    return records.map(toAttachment);
  }
}

function toAttachment(record: AttachmentRecord): MessageAttachment {
  const snapshot: MessageAttachmentSnapshot = {
    id: createMessageAttachmentId(record.id),
    organizationId: record.organizationId,
    conversationId: createConversationId(record.conversationId),
    messageId: record.messageId ? createMessageId(record.messageId) : undefined,
    widgetSessionId: record.widgetSessionId ?? undefined,
    fileName: record.fileName,
    contentType: parseAllowedAttachmentContentType(record.contentType),
    byteSize: record.byteSize,
    storageKey: record.storageKey,
    createdAt: record.createdAt,
  };
  return MessageAttachment.reconstitute(snapshot);
}

function toRecord(
  snapshot: MessageAttachmentSnapshot,
): Prisma.MessageAttachmentUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    conversationId: snapshot.conversationId,
    messageId: snapshot.messageId ?? null,
    widgetSessionId: snapshot.widgetSessionId ?? null,
    fileName: snapshot.fileName,
    contentType: snapshot.contentType,
    byteSize: snapshot.byteSize,
    storageKey: snapshot.storageKey,
    createdAt: snapshot.createdAt,
  };
}
