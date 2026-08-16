import type { EventBus } from '@ai-customer-support/shared';
import { MessageSentEvent } from '../domain/events.js';
import { Message } from '../domain/message.js';
import type { Conversation } from '../domain/conversation.js';
import { SYSTEM_ACTOR_ID } from '../domain/support-constants.js';
import type { ConversationRepository } from './ports/conversation-repository.js';
import type { MessageRepository } from './ports/message-repository.js';

export async function recordCustomerVisibleSystemMessage(input: {
  readonly conversations: ConversationRepository;
  readonly messages: MessageRepository;
  readonly eventBus: EventBus;
  readonly conversation: Conversation;
  readonly tenantId: string;
  readonly body: string;
  readonly now: Date;
  readonly correlationId?: string;
}): Promise<Message> {
  const message = Message.create({
    conversationId: input.conversation.id,
    organizationId: input.tenantId,
    authorType: 'system',
    authorId: SYSTEM_ACTOR_ID,
    body: input.body,
    now: input.now,
  });

  input.conversation.recordMessage(message, input.now);
  await input.conversations.save(input.conversation);
  await input.messages.save(message);
  await input.eventBus.publish(
    new MessageSentEvent(
      crypto.randomUUID(),
      input.now,
      input.tenantId,
      input.conversation.id,
      message.id,
      SYSTEM_ACTOR_ID,
      'system',
      input.correlationId,
    ),
  );

  return message;
}
