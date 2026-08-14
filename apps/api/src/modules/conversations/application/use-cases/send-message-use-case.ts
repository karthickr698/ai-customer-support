import type { ConversationDto, MessageDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { MessageReceivedEvent, MessageSentEvent } from '../../domain/events.js';
import { Message } from '../../domain/message.js';
import { toConversationDto, toMessageDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class SendMessageUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly body: string;
    readonly authorType?: 'customer' | 'agent';
    readonly security: RequestSecurityContext;
  }): Promise<{ message: MessageDto; conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_WRITE,
    });

    const now = this.clock.now();
    const authorType = input.authorType ?? 'agent';
    const message = Message.create({
      conversationId: conversation.id,
      organizationId: actor.tenantId,
      authorType,
      authorId: authorType === 'agent' ? actor.actorId : undefined,
      body: input.body,
      now,
    });

    conversation.recordMessage(message, now);
    await this.conversations.save(conversation);
    await this.messages.save(message);

    if (authorType === 'agent') {
      await this.eventBus.publish(
        new MessageSentEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          conversation.id,
          message.id,
          actor.actorId,
          input.security.correlationId,
        ),
      );
    } else {
      await this.eventBus.publish(
        new MessageReceivedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          conversation.id,
          message.id,
          authorType,
          input.security.correlationId,
        ),
      );
    }

    const assignee = conversation.assignedAgentId
      ? await this.users.findById(conversation.assignedAgentId)
      : null;

    return {
      message: toMessageDto(message),
      conversation: toConversationDto(conversation, assignee),
    };
  }
}
