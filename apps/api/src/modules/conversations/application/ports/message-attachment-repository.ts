import type { ConversationId } from '../../domain/conversation-id.js';
import type { MessageAttachment } from '../../domain/message-attachment.js';
import type { MessageAttachmentId } from '../../domain/message-attachment-id.js';
import type { MessageId } from '../../domain/message-id.js';

export interface MessageAttachmentRepository {
  save(attachment: MessageAttachment): Promise<void>;
  findById(tenantId: string, attachmentId: MessageAttachmentId): Promise<MessageAttachment | null>;
  listByConversation(
    tenantId: string,
    conversationId: ConversationId,
  ): Promise<MessageAttachment[]>;
  listByMessageIds(
    tenantId: string,
    messageIds: readonly MessageId[],
  ): Promise<MessageAttachment[]>;
  listByIds(
    tenantId: string,
    conversationId: ConversationId,
    attachmentIds: readonly MessageAttachmentId[],
  ): Promise<MessageAttachment[]>;
}
