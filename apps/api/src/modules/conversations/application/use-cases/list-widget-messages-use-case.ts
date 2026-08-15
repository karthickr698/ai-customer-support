import type { MessageListResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { toMessageDto } from '../dtos.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import type { MessageAttachmentRepository } from '../ports/message-attachment-repository.js';
import type { MessageFeedbackRepository } from '../ports/message-feedback-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';
import { groupAttachmentsByMessage } from '../group-attachments-by-message.js';
import { groupFeedbackByMessage } from '../group-feedback-by-message.js';

export class ListWidgetMessagesUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly messages: MessageRepository,
    private readonly attachments: MessageAttachmentRepository,
    private readonly feedbacks: MessageFeedbackRepository,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly page: PageRequest;
  }): Promise<MessageListResponse> {
    const { actor, conversation } = await this.authorized.execute(input);
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
    const feedbackByMessage = groupFeedbackByMessage(
      await this.feedbacks.listBySessionAndMessageIds(
        actor.tenantId,
        actor.sessionId,
        result.items.map((message) => message.id),
      ),
    );

    return {
      items: result.items.map((message) =>
        toMessageDto(
          message,
          grouped.get(message.id) ?? [],
          feedbackByMessage.get(message.id) ?? null,
        ),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
