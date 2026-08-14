import type { MessageListResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { groupAttachmentsByMessage } from '../group-attachments-by-message.js';
import { toMessageDto } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { MessageAttachmentRepository } from '../ports/message-attachment-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';

export class ListMessagesUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly messages: MessageRepository,
    private readonly attachments: MessageAttachmentRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly page: PageRequest;
  }): Promise<MessageListResponse> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_READ,
    });

    const result = await this.messages.listByConversation(
      actor.tenantId,
      conversation.id,
      input.page,
    );
    const grouped = groupAttachmentsByMessage(
      await this.attachments.listByMessageIds(
        actor.tenantId,
        result.items.map((message) => message.id),
      ),
    );

    return {
      items: result.items.map((message) => toMessageDto(message, grouped.get(message.id) ?? [])),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
