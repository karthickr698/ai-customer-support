import type { ConversationDto, MessageDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { EmptyMessageError } from '../../domain/errors.js';
import { MessageReceivedEvent } from '../../domain/events.js';
import { Message } from '../../domain/message.js';
import { toConversationDto, toMessageDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import { persistMessageAttachments } from '../persist-message-attachments.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { MessageAttachmentRepository } from '../ports/message-attachment-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';

export class SendWidgetMessageUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly attachments: MessageAttachmentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly body?: string;
    readonly attachmentIds?: readonly string[];
    readonly security: RequestSecurityContext;
  }): Promise<{ message: MessageDto; conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute(input);
    const body = input.body?.trim();
    const attachmentIds = input.attachmentIds ?? [];
    if (!body && attachmentIds.length === 0) {
      throw new EmptyMessageError();
    }

    const now = this.clock.now();
    const message = Message.create({
      conversationId: conversation.id,
      organizationId: actor.tenantId,
      authorType: 'customer',
      body: body && body.length > 0 ? body : 'Sent an attachment',
      now,
    });
    conversation.recordMessage(message, now);
    await this.conversations.save(conversation);
    await this.messages.save(message);
    const linked = await persistMessageAttachments({
      attachments: this.attachments,
      tenantId: actor.tenantId,
      conversationId: conversation.id,
      messageId: message.id,
      attachmentIds,
      sessionId: actor.sessionId,
    });
    await this.eventBus.publish(
      new MessageReceivedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        message.id,
        'customer',
        input.security.correlationId,
      ),
    );

    return {
      message: toMessageDto(message, linked),
      conversation: toConversationDto(conversation, null),
    };
  }
}
