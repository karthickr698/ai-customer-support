import type { ConversationId } from '../../domain/conversation-id.js';
import type { MessageFeedback } from '../../domain/message-feedback.js';
import type { MessageId } from '../../domain/message-id.js';

export interface MessageFeedbackRepository {
  save(feedback: MessageFeedback): Promise<void>;
  findBySessionAndMessage(
    tenantId: string,
    sessionId: string,
    messageId: MessageId,
  ): Promise<MessageFeedback | null>;
  listBySessionAndMessageIds(
    tenantId: string,
    sessionId: string,
    messageIds: readonly MessageId[],
  ): Promise<MessageFeedback[]>;
  listByConversation(
    tenantId: string,
    conversationId: ConversationId,
  ): Promise<MessageFeedback[]>;
}
