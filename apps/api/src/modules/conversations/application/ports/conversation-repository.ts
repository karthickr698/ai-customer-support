import type { Conversation } from '../../domain/conversation.js';
import type { ConversationId } from '../../domain/conversation-id.js';
import type { ConversationStatus } from '../../domain/conversation-status.js';

export type ConversationSearchFilter = {
  readonly tenantId: string;
  readonly query?: string;
  readonly status?: ConversationStatus;
  readonly assignedAgentId?: string | 'unassigned';
  readonly tag?: string;
};

export interface ConversationRepository {
  findById(tenantId: string, conversationId: ConversationId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  search(
    filter: ConversationSearchFilter,
    page: { readonly page: number; readonly pageSize: number },
  ): Promise<{ readonly items: Conversation[]; readonly total: number }>;
}
