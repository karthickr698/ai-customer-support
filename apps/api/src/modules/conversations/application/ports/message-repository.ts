import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { ConversationId } from '../../domain/conversation-id.js';
import type { Message } from '../../domain/message.js';

export interface MessageRepository {
  save(message: Message): Promise<void>;
  findById(tenantId: string, messageId: string): Promise<Message | null>;
  listByConversation(
    tenantId: string,
    conversationId: ConversationId,
    page: PageRequest,
  ): Promise<Page<Message>>;
  listRecent(
    tenantId: string,
    conversationId: ConversationId,
    limit: number,
  ): Promise<Message[]>;
}
