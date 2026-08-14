import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AgentUnassignedEvent } from '../../domain/events.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';

export class UnassignConversationUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly conversations: ConversationRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_ASSIGN,
    });

    const now = this.clock.now();
    conversation.unassign(now);
    await this.conversations.save(conversation);

    await this.eventBus.publish(
      new AgentUnassignedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    return { conversation: toConversationDto(conversation, null) };
  }
}
