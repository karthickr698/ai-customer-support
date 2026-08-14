import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationStatusChangedEvent } from '../../domain/events.js';
import type { AgentConversationStatus } from '../../domain/conversation-status.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class ChangeConversationStatusUseCase {
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
    readonly status: AgentConversationStatus;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_WRITE,
    });

    const fromStatus = conversation.status;
    const now = this.clock.now();
    conversation.transitionTo(input.status, now);
    await this.conversations.save(conversation);

    await this.eventBus.publish(
      new ConversationStatusChangedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        fromStatus,
        conversation.status,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    const assignee = conversation.assignedAgentId
      ? await this.users.findById(conversation.assignedAgentId)
      : null;

    return { conversation: toConversationDto(conversation, assignee) };
  }
}
