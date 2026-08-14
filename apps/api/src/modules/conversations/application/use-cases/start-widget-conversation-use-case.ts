import type { ConversationDto, MessageDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Conversation } from '../../domain/conversation.js';
import { CustomerContact } from '../../domain/customer-contact.js';
import { ConversationCreatedEvent, MessageReceivedEvent } from '../../domain/events.js';
import { Message } from '../../domain/message.js';
import type { MessageAttachment } from '../../domain/message-attachment.js';
import { toConversationDto, toMessageDto, type RequestSecurityContext } from '../dtos.js';
import { persistMessageAttachments } from '../persist-message-attachments.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { MessageAttachmentRepository } from '../ports/message-attachment-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';
import type { WidgetSessionContextPort } from '../ports/widget-session-context-port.js';

export class StartWidgetConversationUseCase {
  constructor(
    private readonly widgetSessions: WidgetSessionContextPort,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly attachments: MessageAttachmentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly subject?: string;
    readonly message?: string;
    readonly attachmentIds?: readonly string[];
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto; message: MessageDto | null }> {
    const actor = await this.widgetSessions.requireSession(input.sessionToken, input.origin);
    const now = this.clock.now();
    const conversation = Conversation.create({
      organizationId: actor.tenantId,
      customer: CustomerContact.forWidgetVisitor({
        visitorId: actor.visitorId,
        email: actor.email,
        name: actor.name,
        customerId: actor.customerId,
      }),
      channel: 'widget',
      widgetSessionId: actor.sessionId,
      subject: input.subject,
      now,
    });

    const body = input.message?.trim();
    const attachmentIds = input.attachmentIds ?? [];
    let created: Message | undefined;
    if (body || attachmentIds.length > 0) {
      created = Message.create({
        conversationId: conversation.id,
        organizationId: actor.tenantId,
        authorType: 'customer',
        body: body && body.length > 0 ? body : 'Sent an attachment',
        now,
      });
      conversation.recordMessage(created, now);
    }

    await this.conversations.save(conversation);
    let linked: MessageAttachment[] = [];
    if (created) {
      await this.messages.save(created);
      linked = await persistMessageAttachments({
        attachments: this.attachments,
        tenantId: actor.tenantId,
        conversationId: conversation.id,
        messageId: created.id,
        attachmentIds,
        sessionId: actor.sessionId,
      });
    }

    await this.eventBus.publish(
      new ConversationCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        actor.sessionId,
        input.security.correlationId,
      ),
    );

    if (created) {
      await this.eventBus.publish(
        new MessageReceivedEvent(
          crypto.randomUUID(),
          now,
          actor.tenantId,
          conversation.id,
          created.id,
          'customer',
          input.security.correlationId,
        ),
      );
    }

    return {
      conversation: toConversationDto(conversation, null),
      message: created ? toMessageDto(created, linked) : null,
    };
  }
}
