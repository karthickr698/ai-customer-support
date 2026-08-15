import type {
  GenerateSupportReplyRequest,
  SupportChatMessageDto,
  WidgetStreamEvent,
} from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import type { AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { EmptyMessageError } from '../../domain/errors.js';
import { MessageReceivedEvent, MessageSentEvent } from '../../domain/events.js';
import { Message } from '../../domain/message.js';
import { toConversationDto, toMessageDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import { persistMessageAttachments } from '../persist-message-attachments.js';
import type { AgentSettingsQueryPort } from '../ports/agent-settings-query-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { MessageAttachmentRepository } from '../ports/message-attachment-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';

export class StreamWidgetAiReplyUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly attachments: MessageAttachmentRepository,
    private readonly agentSettings: AgentSettingsQueryPort,
    private readonly ai: AIServicePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async *execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
    readonly body?: string;
    readonly attachmentIds?: readonly string[];
    readonly security: RequestSecurityContext;
  }): AsyncIterable<WidgetStreamEvent> {
    const { actor, settings, conversation } = await this.authorized.execute(input);
    const body = input.body?.trim();
    const attachmentIds = input.attachmentIds ?? [];
    if (!body && attachmentIds.length === 0) {
      throw new EmptyMessageError();
    }

    const now = this.clock.now();
    const customerMessage = Message.create({
      conversationId: conversation.id,
      organizationId: actor.tenantId,
      authorType: 'customer',
      body: body && body.length > 0 ? body : 'Sent an attachment',
      now,
    });
    conversation.recordMessage(customerMessage, now);
    await this.conversations.save(conversation);
    await this.messages.save(customerMessage);
    const linked = await persistMessageAttachments({
      attachments: this.attachments,
      tenantId: actor.tenantId,
      conversationId: conversation.id,
      messageId: customerMessage.id,
      attachmentIds,
      sessionId: actor.sessionId,
    });
    await this.eventBus.publish(
      new MessageReceivedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        customerMessage.id,
        'customer',
        input.security.correlationId,
      ),
    );

    yield {
      type: 'message',
      message: toMessageDto(customerMessage, linked),
      conversation: toConversationDto(conversation, null),
    };

    if (!settings.aiEnabled || !conversation.canGenerateAiReply()) {
      yield { type: 'done', message: null, conversation: toConversationDto(conversation, null) };
      return;
    }

    yield { type: 'typing', active: true };

    const history = await this.messages.listRecent(actor.tenantId, conversation.id, 20);
    const request: GenerateSupportReplyRequest = {
      conversationId: conversation.id,
      visitorMessage: customerMessage.body,
      history: history.map(toChatMessage),
      widgetGreeting: settings.greeting,
      agentSettings: toReplySettings(await this.agentSettings.findByTenant(actor.tenantId)),
    };

    let complete = '';
    try {
      for await (const event of this.ai.streamSupportReply(
        {
          tenantId: actor.tenantId,
          requestId: input.security.requestId,
          correlationId: input.security.correlationId ?? input.security.requestId,
          traceId: input.security.traceId,
          spanId: input.security.spanId,
        },
        request,
      )) {
        if (event.type === 'delta') {
          complete += event.text;
          yield { type: 'delta', text: event.text };
          continue;
        }

        if (event.type === 'error') {
          yield { type: 'typing', active: false };
          yield { type: 'error', code: event.code, message: event.message };
          yield { type: 'done', message: null, conversation: toConversationDto(conversation, null) };
          return;
        }

        complete = event.reply.content;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'The AI service failed';
      yield { type: 'typing', active: false };
      yield { type: 'error', code: 'AI_PROVIDER_ERROR', message };
      yield { type: 'done', message: null, conversation: toConversationDto(conversation, null) };
      return;
    }

    yield { type: 'typing', active: false };

    const replyBody = complete.trim();
    if (!replyBody) {
      yield { type: 'done', message: null, conversation: toConversationDto(conversation, null) };
      return;
    }

    const replyAt = this.clock.now();
    const aiMessage = Message.create({
      conversationId: conversation.id,
      organizationId: actor.tenantId,
      authorType: 'ai',
      body: replyBody,
      now: replyAt,
    });
    conversation.recordMessage(aiMessage, replyAt);
    await this.conversations.save(conversation);
    await this.messages.save(aiMessage);
    await this.eventBus.publish(
      new MessageSentEvent(
        crypto.randomUUID(),
        replyAt,
        actor.tenantId,
        conversation.id,
        aiMessage.id,
        'ai',
        input.security.correlationId,
      ),
    );

    yield {
      type: 'done',
      message: toMessageDto(aiMessage),
      conversation: toConversationDto(conversation, null),
    };
  }
}

function toChatMessage(message: Message): SupportChatMessageDto {
  return {
    role: message.authorType === 'customer' ? 'customer' : message.authorType === 'ai' ? 'ai' : message.authorType,
    content: message.body,
  };
}

function toReplySettings(
  settings: Awaited<ReturnType<AgentSettingsQueryPort['findByTenant']>>,
): GenerateSupportReplyRequest['agentSettings'] {
  if (!settings) {
    return undefined;
  }

  return {
    assistantName: settings.assistantName,
    greeting: settings.greeting,
    systemInstructions: settings.systemInstructions,
    allowedTopics: settings.allowedTopics,
    forbiddenTopics: settings.forbiddenTopics,
    language: settings.language,
    escalateWhen: settings.escalateWhen,
  };
}
