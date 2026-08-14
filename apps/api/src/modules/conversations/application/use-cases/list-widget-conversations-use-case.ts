import type { ConversationListResponse, ConversationResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { toConversationDto } from '../dtos.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { WidgetSessionContextPort } from '../ports/widget-session-context-port.js';

export class ListWidgetConversationsUseCase {
  constructor(
    private readonly widgetSessions: WidgetSessionContextPort,
    private readonly conversations: ConversationRepository,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly page: PageRequest;
  }): Promise<ConversationListResponse> {
    const actor = await this.widgetSessions.requireSession(input.sessionToken, input.origin);
    const result = await this.conversations.search(
      { tenantId: actor.tenantId, widgetSessionId: actor.sessionId },
      input.page,
    );

    return {
      items: result.items.map((conversation) => toConversationDto(conversation, null)),
      total: result.total,
      page: input.page.page,
      pageSize: input.page.pageSize,
    };
  }
}

export class GetWidgetConversationUseCase {
  constructor(private readonly authorized: LoadWidgetConversationService) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
  }): Promise<ConversationResponse> {
    const { conversation } = await this.authorized.execute(input);
    return { conversation: toConversationDto(conversation, null) };
  }
}
