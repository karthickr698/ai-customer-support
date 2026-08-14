import {
  AttachmentNotFoundError,
  InvalidAttachmentError,
  UnauthorizedConversationAccessError,
} from '../domain/errors.js';
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  type MessageAttachment,
} from '../domain/message-attachment.js';
import { createMessageAttachmentId } from '../domain/message-attachment-id.js';
import type { ConversationId } from '../domain/conversation-id.js';
import type { MessageId } from '../domain/message-id.js';
import type { MessageAttachmentRepository } from './ports/message-attachment-repository.js';

export async function persistMessageAttachments(input: {
  readonly attachments: MessageAttachmentRepository;
  readonly tenantId: string;
  readonly conversationId: ConversationId;
  readonly messageId: MessageId;
  readonly attachmentIds: readonly string[];
  readonly sessionId?: string;
}): Promise<MessageAttachment[]> {
  if (input.attachmentIds.length === 0) {
    return [];
  }

  if (input.attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new InvalidAttachmentError('A message can include at most 5 attachments');
  }

  const uniqueIds = [...new Set(input.attachmentIds)].map(createMessageAttachmentId);
  const records = await input.attachments.listByIds(
    input.tenantId,
    input.conversationId,
    uniqueIds,
  );
  if (records.length !== uniqueIds.length) {
    throw new AttachmentNotFoundError();
  }

  for (const attachment of records) {
    if (!attachment.belongsTo(input.tenantId) || attachment.conversationId !== input.conversationId) {
      throw new UnauthorizedConversationAccessError();
    }

    if (input.sessionId && attachment.widgetSessionId && attachment.widgetSessionId !== input.sessionId) {
      throw new UnauthorizedConversationAccessError();
    }

    attachment.attachToMessage(input.messageId);
    await input.attachments.save(attachment);
  }

  return records;
}
