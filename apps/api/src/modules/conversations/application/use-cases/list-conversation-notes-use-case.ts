import type { ConversationNoteListResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { toNoteDto } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ConversationNoteRepository } from '../ports/conversation-note-repository.js';

export class ListConversationNotesUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly notes: ConversationNoteRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly page: PageRequest;
  }): Promise<ConversationNoteListResponse> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_READ,
    });

    const result = await this.notes.listByConversation(actor.tenantId, conversation.id, input.page);

    return {
      items: result.items.map(toNoteDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
