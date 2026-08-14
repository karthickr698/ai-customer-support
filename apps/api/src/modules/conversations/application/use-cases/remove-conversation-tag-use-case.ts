import type { ConversationDto } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationTag } from '../../domain/conversation-tag.js';
import { toConversationDto } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class RemoveConversationTagUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly conversations: ConversationRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly name: string;
  }): Promise<{ conversation: ConversationDto }> {
    const { conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_WRITE,
    });

    conversation.removeTag(ConversationTag.parse(input.name), this.clock.now());
    await this.conversations.save(conversation);

    const assignee = conversation.assignedAgentId
      ? await this.users.findById(conversation.assignedAgentId)
      : null;

    return { conversation: toConversationDto(conversation, assignee) };
  }
}
