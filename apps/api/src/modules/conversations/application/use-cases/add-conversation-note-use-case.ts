import type { ConversationNoteDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationNote } from '../../domain/conversation-note.js';
import { ConversationNoteAddedEvent } from '../../domain/events.js';
import { toNoteDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationNoteRepository } from '../ports/conversation-note-repository.js';

export class AddConversationNoteUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly notes: ConversationNoteRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly body: string;
    readonly security: RequestSecurityContext;
  }): Promise<{ note: ConversationNoteDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_WRITE,
    });

    const now = this.clock.now();
    const note = ConversationNote.create({
      conversationId: conversation.id,
      organizationId: actor.tenantId,
      authorId: actor.actorId,
      body: input.body,
      now,
    });

    await this.notes.save(note);

    await this.eventBus.publish(
      new ConversationNoteAddedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        note.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    return { note: toNoteDto(note) };
  }
}
