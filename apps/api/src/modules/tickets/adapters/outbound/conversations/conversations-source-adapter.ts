import type { ConversationTicketSourceQuery } from '../../../../conversations/application/conversation-ticket-source-query.js';
import type { ConversationSourcePort, ConversationSourceRecord } from '../../../application/ports.js';

export class ConversationsSourceAdapter implements ConversationSourcePort {
  constructor(private readonly query: ConversationTicketSourceQuery) {}

  findById(tenantId: string, conversationId: string): Promise<ConversationSourceRecord | null> {
    return this.query.findById(tenantId, conversationId);
  }
}
