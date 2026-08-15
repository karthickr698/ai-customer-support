import type {
  ConversationAssigneeDto,
  ConversationDto,
  ConversationNoteDto,
  MessageAttachmentDto,
  MessageDto,
} from '@ai-customer-support/contracts';
import type { Conversation } from '../domain/conversation.js';
import type { ConversationNote } from '../domain/conversation-note.js';
import type { Message } from '../domain/message.js';
import type { MessageAttachment } from '../domain/message-attachment.js';
import type { DirectoryUser } from './ports/user-directory-port.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
};

export function toConversationDto(
  conversation: Conversation,
  assignee: DirectoryUser | null,
): ConversationDto {
  const snapshot = conversation.toSnapshot();

  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    customerId: snapshot.customerId ?? null,
    customerEmail: snapshot.customerEmail,
    customerName: snapshot.customerName,
    subject: snapshot.subject ?? null,
    status: snapshot.status,
    assignedAgentId: snapshot.assignedAgentId ?? null,
    assignedAgent: assignee ? toAssigneeDto(assignee) : null,
    channel: snapshot.channel,
    widgetSessionId: snapshot.widgetSessionId ?? null,
    tags: snapshot.tags,
    lastMessageAt: snapshot.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: snapshot.lastMessagePreview ?? null,
    createdByUserId: snapshot.createdByUserId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toAttachmentDto(attachment: MessageAttachment): MessageAttachmentDto {
  const snapshot = attachment.toSnapshot();
  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId,
    messageId: snapshot.messageId ?? null,
    fileName: snapshot.fileName,
    contentType: snapshot.contentType,
    byteSize: snapshot.byteSize,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toMessageDto(
  message: Message,
  attachments: readonly MessageAttachment[] = [],
): MessageDto {
  const snapshot = message.toSnapshot();
  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId,
    authorType: snapshot.authorType,
    authorId: snapshot.authorId ?? null,
    body: snapshot.body,
    attachments: attachments.map(toAttachmentDto),
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toNoteDto(note: ConversationNote): ConversationNoteDto {
  const snapshot = note.toSnapshot();
  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId,
    authorId: snapshot.authorId,
    body: snapshot.body,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function toAssigneeDto(user: DirectoryUser): ConversationAssigneeDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}
