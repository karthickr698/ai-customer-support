import { ConversationNotFoundError, UnauthorizedConversationAccessError } from '../domain/errors.js';
import { createConversationId } from '../domain/conversation-id.js';
import type { Conversation } from '../domain/conversation.js';
import type { ConversationRepository } from './ports/conversation-repository.js';
import type {
  WidgetRuntimeSettings,
  WidgetSessionActor,
  WidgetSessionContextPort,
} from './ports/widget-session-context-port.js';

export class LoadWidgetConversationService {
  constructor(
    private readonly widgetSessions: WidgetSessionContextPort,
    private readonly conversations: ConversationRepository,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
  }): Promise<{
    actor: WidgetSessionActor;
    settings: WidgetRuntimeSettings;
    conversation: Conversation;
  }> {
    const actor = await this.widgetSessions.requireSession(input.sessionToken, input.origin);
    const settings = await this.widgetSessions.loadRuntimeSettings(actor.tenantId);
    const conversation = await this.conversations.findById(
      actor.tenantId,
      createConversationId(input.conversationId),
    );
    if (!conversation || !conversation.belongsTo(actor.tenantId)) {
      throw new ConversationNotFoundError();
    }

    try {
      conversation.assertOwnedByWidgetSession(actor.sessionId);
    } catch {
      throw new UnauthorizedConversationAccessError();
    }

    return { actor, settings, conversation };
  }
}
