import type { EventBus } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../../apps/api/src/modules/conversations/domain/conversation.ts';
import { CustomerContact } from '../../../apps/api/src/modules/conversations/domain/customer-contact.ts';
import {
  MessageFeedbackNotAllowedError,
  MessageNotFoundError,
} from '../../../apps/api/src/modules/conversations/domain/errors.ts';
import { Message } from '../../../apps/api/src/modules/conversations/domain/message.ts';
import { MessageFeedback } from '../../../apps/api/src/modules/conversations/domain/message-feedback.ts';
import type { LoadWidgetConversationService } from '../../../apps/api/src/modules/conversations/application/load-widget-conversation-service.ts';
import type { ClockPort } from '../../../apps/api/src/modules/conversations/application/ports/clock-port.ts';
import type { MessageFeedbackRepository } from '../../../apps/api/src/modules/conversations/application/ports/message-feedback-repository.ts';
import type { MessageRepository } from '../../../apps/api/src/modules/conversations/application/ports/message-repository.ts';
import { SubmitWidgetMessageFeedbackUseCase } from '../../../apps/api/src/modules/conversations/application/use-cases/submit-widget-message-feedback-use-case.ts';
import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { ConversationId } from '../../../apps/api/src/modules/conversations/domain/conversation-id.ts';
import type { MessageId } from '../../../apps/api/src/modules/conversations/domain/message-id.ts';

const now = new Date('2026-08-15T12:00:00.000Z');
const tenantId = '11111111-1111-4111-8111-111111111111';
const sessionId = '33333333-3333-4333-8333-333333333333';

class MemoryMessages implements MessageRepository {
  constructor(private readonly message: Message | null) {}
  async save(): Promise<void> {}
  async findById(): Promise<Message | null> {
    return this.message;
  }
  async listByConversation(
    _tenantId: string,
    _conversationId: ConversationId,
    page: PageRequest,
  ): Promise<Page<Message>> {
    return { items: this.message ? [this.message] : [], total: this.message ? 1 : 0, page: page.page, pageSize: page.pageSize };
  }
  async listRecent(): Promise<Message[]> {
    return this.message ? [this.message] : [];
  }
}

class MemoryFeedbacks implements MessageFeedbackRepository {
  readonly items = new Map<string, MessageFeedback>();

  async save(feedback: MessageFeedback): Promise<void> {
    this.items.set(`${feedback.widgetSessionId}:${feedback.messageId}`, feedback);
  }

  async findBySessionAndMessage(
    _tenantId: string,
    session: string,
    messageId: MessageId,
  ): Promise<MessageFeedback | null> {
    return this.items.get(`${session}:${messageId}`) ?? null;
  }

  async listBySessionAndMessageIds(): Promise<MessageFeedback[]> {
    return [...this.items.values()];
  }

  async listByConversation(): Promise<MessageFeedback[]> {
    return [...this.items.values()];
  }
}

class MemoryEvents implements EventBus {
  readonly names: string[] = [];
  async publish(event: { eventName: string }): Promise<void> {
    this.names.push(event.eventName);
  }
  subscribe(): void {}
}

const clock: ClockPort = { now: () => now };

function createConversation() {
  return Conversation.create({
    organizationId: tenantId,
    customer: CustomerContact.forWidgetVisitor({ visitorId: 'visitor-1' }),
    channel: 'widget',
    widgetSessionId: sessionId,
    now,
  });
}

function authorizedFor(conversation: Conversation): LoadWidgetConversationService {
  return {
    execute: async () => ({
      actor: {
        tenantId,
        sessionId,
        visitorId: 'visitor-1',
        kind: 'anonymous' as const,
        email: undefined,
        name: undefined,
        customerId: undefined,
        origin: undefined,
      },
      settings: {
        enabled: true,
        allowAnonymous: true,
        allowAttachments: true,
        aiEnabled: true,
        greeting: 'Hi',
        allowedOrigins: [],
      },
      conversation,
    }),
  } as LoadWidgetConversationService;
}

describe('SubmitWidgetMessageFeedbackUseCase', () => {
  it('records feedback on an AI reply', async () => {
    const conversation = createConversation();
    const message = Message.create({
      conversationId: conversation.id,
      organizationId: tenantId,
      authorType: 'ai',
      body: 'Here is how to track your order.',
      now,
    });
    const feedbacks = new MemoryFeedbacks();
    const events = new MemoryEvents();
    const useCase = new SubmitWidgetMessageFeedbackUseCase(
      authorizedFor(conversation),
      new MemoryMessages(message),
      feedbacks,
      clock,
      events,
    );

    const result = await useCase.execute({
      sessionToken: 'token',
      origin: 'https://shop.example',
      conversationId: conversation.id,
      messageId: message.id,
      rating: 'helpful',
      security: { ipAddress: '127.0.0.1', requestId: 'req-1' },
    });

    expect(result.feedback.rating).toBe('helpful');
    expect(events.names).toEqual(['MessageFeedbackSubmitted']);
    expect(feedbacks.items.size).toBe(1);
  });

  it('rejects feedback on customer messages', async () => {
    const conversation = createConversation();
    const message = Message.create({
      conversationId: conversation.id,
      organizationId: tenantId,
      authorType: 'customer',
      body: 'Where is my order?',
      now,
    });
    const useCase = new SubmitWidgetMessageFeedbackUseCase(
      authorizedFor(conversation),
      new MemoryMessages(message),
      new MemoryFeedbacks(),
      clock,
      new MemoryEvents(),
    );

    await expect(
      useCase.execute({
        sessionToken: 'token',
        origin: undefined,
        conversationId: conversation.id,
        messageId: message.id,
        rating: 'helpful',
        security: { ipAddress: '127.0.0.1', requestId: 'req-1' },
      }),
    ).rejects.toBeInstanceOf(MessageFeedbackNotAllowedError);
  });

  it('rejects missing messages', async () => {
    const conversation = createConversation();
    const useCase = new SubmitWidgetMessageFeedbackUseCase(
      authorizedFor(conversation),
      new MemoryMessages(null),
      new MemoryFeedbacks(),
      clock,
      new MemoryEvents(),
    );

    await expect(
      useCase.execute({
        sessionToken: 'token',
        origin: undefined,
        conversationId: conversation.id,
        messageId: '44444444-4444-4444-8444-444444444444',
        rating: 'helpful',
        security: { ipAddress: '127.0.0.1', requestId: 'req-1' },
      }),
    ).rejects.toBeInstanceOf(MessageNotFoundError);
  });
});
