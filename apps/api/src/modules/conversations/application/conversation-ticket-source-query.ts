import { createConversationId } from '../domain/conversation-id.js';
import type { ConversationRepository } from './ports/conversation-repository.js';

export type ConversationTicketSource = {
  readonly id: string;
  readonly organizationId: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly customerId?: string;
  readonly subject?: string;
  readonly assignedAgentId?: string;
  readonly lastMessagePreview?: string;
  readonly channel: string;
  readonly status: string;
};

export class ConversationTicketSourceQuery {
  constructor(private readonly conversations: ConversationRepository) {}

  async findById(tenantId: string, conversationId: string): Promise<ConversationTicketSource | null> {
    const conversation = await this.conversations.findById(tenantId, createConversationId(conversationId));
    if (!conversation || !conversation.belongsTo(tenantId)) {
      return null;
    }
    const snapshot = conversation.toSnapshot();
    return {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      customerEmail: snapshot.customerEmail,
      customerName: snapshot.customerName,
      customerId: snapshot.customerId,
      subject: snapshot.subject,
      assignedAgentId: snapshot.assignedAgentId,
      lastMessagePreview: snapshot.lastMessagePreview,
      channel: snapshot.channel,
      status: snapshot.status,
    };
  }
}
