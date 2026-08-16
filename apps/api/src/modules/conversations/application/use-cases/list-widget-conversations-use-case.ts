import type { ConversationListResponse, ConversationResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { toConversationDtoWithAssignee } from '../map-conversation-dto.js';
import type { LoadWidgetConversationService } from '../load-widget-conversation-service.js';
import type { AgentAvailabilityPort } from '../ports/agent-availability-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';
import type { WidgetSessionContextPort } from '../ports/widget-session-context-port.js';

export class ListWidgetConversationsUseCase {
  constructor(
    private readonly widgetSessions: WidgetSessionContextPort,
    private readonly conversations: ConversationRepository,
    private readonly users: UserDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
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

    const items = [];
    for (const conversation of result.items) {
      items.push(await toConversationDtoWithAssignee(conversation, this.users, this.availability));
    }

    return {
      items,
      total: result.total,
      page: input.page.page,
      pageSize: input.page.pageSize,
    };
  }
}

export class GetWidgetConversationUseCase {
  constructor(
    private readonly authorized: LoadWidgetConversationService,
    private readonly users: UserDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
  ) {}

  async execute(input: {
    readonly sessionToken: string;
    readonly origin: string | undefined;
    readonly conversationId: string;
  }): Promise<ConversationResponse> {
    const { conversation } = await this.authorized.execute(input);
    return {
      conversation: await toConversationDtoWithAssignee(conversation, this.users, this.availability),
    };
  }
}
