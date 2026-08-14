import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { ConversationId } from '../../domain/conversation-id.js';
import type { ConversationNote } from '../../domain/conversation-note.js';

export interface ConversationNoteRepository {
  save(note: ConversationNote): Promise<void>;
  listByConversation(
    tenantId: string,
    conversationId: ConversationId,
    page: PageRequest,
  ): Promise<Page<ConversationNote>>;
}
