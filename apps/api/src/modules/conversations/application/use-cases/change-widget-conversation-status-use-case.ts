import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { ConversationStatusChangedEvent } from '../../domain/events.js';
import type { ConversationStatus } from '../../domain/conversation-status.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';

export class ChangeWidgetConversationStatusUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly conversations: ConversationRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly status: Extract<ConversationStatus, 'open' | 'resolved' | 'closed'>;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute(input);
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
        actor.sessionId,
        input.security.correlationId,
      ),
    );

    return { conversation: toConversationDto(conversation, null) };
  }
}
