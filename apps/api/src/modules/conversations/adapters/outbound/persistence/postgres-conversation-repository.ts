import type { Prisma, PrismaClient } from '@prisma/client';
import { Conversation, type ConversationSnapshot } from '../../../domain/conversation.js';
import { parseConversationChannel } from '../../../domain/conversation-channel.js';
import { createConversationId, type ConversationId } from '../../../domain/conversation-id.js';
import { parseConversationStatus } from '../../../domain/conversation-status.js';
import { isMessageAuthorType } from '../../../domain/message.js';
import type {
  ConversationRepository,
  ConversationSearchFilter,
} from '../../../application/ports/conversation-repository.js';

type ConversationRecord = {
  id: string;
  organizationId: string;
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  subject: string | null;
  status: string;
  assignedAgentId: string | null;
  channel: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageAuthorType: string | null;
  createdByUserId: string | null;
  widgetSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: readonly { name: string }[];
};

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, conversationId: ConversationId): Promise<Conversation | null> {
    const record = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: tenantId },
      include: { tags: { orderBy: { name: 'asc' } } },
    });

    return record ? toConversation(record) : null;
  }

  async save(conversation: Conversation): Promise<void> {
    const snapshot = conversation.toSnapshot();
    const data = toRecord(snapshot);

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.upsert({
        where: { id: snapshot.id },
        create: data,
        update: {
          customerId: data.customerId,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          subject: data.subject,
          status: data.status,
          assignedAgentId: data.assignedAgentId,
          channel: data.channel,
          lastMessageAt: data.lastMessageAt,
          lastMessagePreview: data.lastMessagePreview,
          lastMessageAuthorType: data.lastMessageAuthorType,
          widgetSessionId: data.widgetSessionId,
          updatedAt: data.updatedAt,
        },
      });

      await tx.conversationTag.deleteMany({
        where: {
          conversationId: snapshot.id,
          name: { notIn: [...snapshot.tags] },
        },
      });

      for (const name of snapshot.tags) {
        await tx.conversationTag.upsert({
          where: {
            conversationId_name: {
              conversationId: snapshot.id,
              name,
            },
          },
          create: {
            id: crypto.randomUUID(),
            conversationId: snapshot.id,
            organizationId: snapshot.organizationId,
            name,
          },
          update: {},
        });
      }
    });
  }

  async search(
    filter: ConversationSearchFilter,
    page: { readonly page: number; readonly pageSize: number },
  ): Promise<{ readonly items: Conversation[]; readonly total: number }> {
    const where = toSearchWhere(filter);
    const skip = (page.page - 1) * page.pageSize;

    const [total, records] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        include: { tags: { orderBy: { name: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: page.pageSize,
      }),
    ]);

    return {
      items: records.map(toConversation),
      total,
    };
  }

  async listEscalationCandidates(
    tenantId: string,
    options?: { readonly assignedAgentId?: string; readonly limit?: number },
  ): Promise<Conversation[]> {
    const records = await this.prisma.conversation.findMany({
      where: {
        organizationId: tenantId,
        status: { in: ['open', 'pending'] },
        ...(options?.assignedAgentId ? { assignedAgentId: options.assignedAgentId } : {}),
      },
      include: { tags: { orderBy: { name: 'asc' } } },
      orderBy: { updatedAt: 'asc' },
      take: options?.limit ?? 500,
    });

    return records.map(toConversation);
  }
}

function toSearchWhere(filter: ConversationSearchFilter): Prisma.ConversationWhereInput {
  const query = filter.query?.trim();
  const assigned = filter.assignedAgentId;

  return {
    organizationId: filter.tenantId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.widgetSessionId ? { widgetSessionId: filter.widgetSessionId } : {}),
    ...(assigned === 'unassigned'
      ? { assignedAgentId: null }
      : assigned
        ? { assignedAgentId: assigned }
        : {}),
    ...(filter.tag ? { tags: { some: { name: filter.tag } } } : {}),
    ...(query
      ? {
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
            { customerEmail: { contains: query, mode: 'insensitive' } },
            { lastMessagePreview: { contains: query, mode: 'insensitive' } },
            { tags: { some: { name: { contains: query, mode: 'insensitive' } } } },
            { messages: { some: { body: { contains: query, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
}

function toConversation(record: ConversationRecord): Conversation {
  const snapshot: ConversationSnapshot = {
    id: createConversationId(record.id),
    organizationId: record.organizationId,
    customerId: record.customerId ?? undefined,
    customerEmail: record.customerEmail,
    customerName: record.customerName,
    subject: record.subject ?? undefined,
    status: parseConversationStatus(record.status),
    assignedAgentId: record.assignedAgentId ?? undefined,
    channel: parseConversationChannel(record.channel),
    tags: record.tags.map((tag) => tag.name),
    lastMessageAt: record.lastMessageAt ?? undefined,
    lastMessagePreview: record.lastMessagePreview ?? undefined,
      lastMessageAuthorType:
      record.lastMessageAuthorType && isMessageAuthorType(record.lastMessageAuthorType)
        ? record.lastMessageAuthorType
        : undefined,
    createdByUserId: record.createdByUserId ?? undefined,
    widgetSessionId: record.widgetSessionId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  return Conversation.reconstitute(snapshot);
}

function toRecord(snapshot: ConversationSnapshot): Prisma.ConversationUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    customerId: snapshot.customerId ?? null,
    customerEmail: snapshot.customerEmail,
    customerName: snapshot.customerName,
    subject: snapshot.subject ?? null,
    status: snapshot.status,
    assignedAgentId: snapshot.assignedAgentId ?? null,
    channel: snapshot.channel,
    lastMessageAt: snapshot.lastMessageAt ?? null,
    lastMessagePreview: snapshot.lastMessagePreview ?? null,
    lastMessageAuthorType: snapshot.lastMessageAuthorType ?? null,
    createdByUserId: snapshot.createdByUserId ?? null,
    widgetSessionId: snapshot.widgetSessionId ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
