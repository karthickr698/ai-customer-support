import type { ConversationDto, ConversationPriority } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { parseConversationPriority } from '../../domain/conversation-priority.js';
import { ConversationPriorityChangedEvent } from '../../domain/events.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class ChangeConversationPriorityUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly conversations: ConversationRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly priority: ConversationPriority;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_WRITE,
    });

    const fromPriority = conversation.priority;
    const now = this.clock.now();
    conversation.changePriority(parseConversationPriority(input.priority), now);
    await this.conversations.save(conversation);

    if (fromPriority !== conversation.priority) {
      await this.eventBus.publish(
        new ConversationPriorityChangedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          conversation.id,
          fromPriority,
          conversation.priority,
          actor.actorId,
          input.security.correlationId,
        ),
      );
    }

    const assignee = conversation.assignedAgentId
      ? await this.users.findById(conversation.assignedAgentId)
      : null;

    return { conversation: toConversationDto(conversation, assignee) };
  }
}
