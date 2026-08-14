import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationEscalatedEvent } from '../../domain/events.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class EscalateConversationUseCase {
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
    readonly reason?: string;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_ESCALATE,
    });

    const now = this.clock.now();
    conversation.escalate(now);
    await this.conversations.save(conversation);

    const reason = input.reason?.trim();
    await this.eventBus.publish(
      new ConversationEscalatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        actor.actorId,
        reason && reason.length > 0 ? reason : undefined,
        input.security.correlationId,
      ),
    );

    const assignee = conversation.assignedAgentId
      ? await this.users.findById(conversation.assignedAgentId)
      : null;

    return { conversation: toConversationDto(conversation, assignee) };
  }
}
