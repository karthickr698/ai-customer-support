import type { ConversationDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { toConversationDtoWithAssignee } from '../map-conversation-dto.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { AgentAvailabilityPort } from '../ports/agent-availability-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class GetConversationUseCase {
  constructor(
    private readonly conversations: LoadAuthorizedConversationService,
    private readonly users: UserDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
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

    return {
      conversation: await toConversationDtoWithAssignee(conversation, this.users, this.availability),
    };
  }
}
