import type { MessageFeedbackResponse } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { MessageFeedbackNotAllowedError, MessageNotFoundError } from '../../domain/errors.js';
import { MessageFeedbackSubmittedEvent } from '../../domain/events.js';
import { MessageFeedback } from '../../domain/message-feedback.js';
import { createMessageId } from '../../domain/message-id.js';
import { toFeedbackDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { MessageFeedbackRepository } from '../ports/message-feedback-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';

export class SubmitWidgetMessageFeedbackUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly messages: MessageRepository,
    private readonly feedbacks: MessageFeedbackRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly messageId: string;
    readonly rating: string;
    readonly comment?: string;
    readonly security: RequestSecurityContext;
  }): Promise<MessageFeedbackResponse> {
    const { actor, conversation } = await this.authorized.execute(input);
    const message = await this.messages.findById(actor.tenantId, input.messageId);
    if (!message || message.conversationId !== conversation.id) {
      throw new MessageNotFoundError();
    }

    if (message.authorType !== 'ai' && message.authorType !== 'agent') {
      throw new MessageFeedbackNotAllowedError();
    }

    const now = this.clock.now();
    const existing = await this.feedbacks.findBySessionAndMessage(
      actor.tenantId,
      actor.sessionId,
      createMessageId(message.id),
    );
    const feedback =
      existing ??
      MessageFeedback.create({
        organizationId: actor.tenantId,
        conversationId: conversation.id,
        messageId: createMessageId(message.id),
        widgetSessionId: actor.sessionId,
        rating: input.rating,
        comment: input.comment,
        now,
      });

    if (existing) {
      feedback.update({ rating: input.rating, comment: input.comment, now });
    }

    await this.feedbacks.save(feedback);
    await this.eventBus.publish(
      new MessageFeedbackSubmittedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        message.id,
        feedback.rating,
        actor.sessionId,
        input.security.correlationId,
      ),
    );

    return { feedback: toFeedbackDto(feedback) };
  }
}
