import type { ConversationDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { toConversationDto } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class GetConversationUseCase {
  constructor(
    private readonly conversations: LoadAuthorizedConversationService,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
  }): Promise<{ conversation: ConversationDto }> {
    const { conversation } = await this.conversations.execute({
      ...input,
      permission: Permissions.CONVERSATION_READ,
    });

    const assignee = conversation.assignedAgentId
      ? await this.users.findById(conversation.assignedAgentId)
      : null;

    return { conversation: toConversationDto(conversation, assignee) };
  }
}
