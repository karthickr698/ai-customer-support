import { ConversationNotFoundError } from '../domain/errors.js';
import { ConversationPolicy } from '../domain/conversation-policy.js';
import { createConversationId } from '../domain/conversation-id.js';
import type { Conversation } from '../domain/conversation.js';
import type { ConversationRepository } from './ports/conversation-repository.js';
import type { ConversationActor, TenantAccessPort } from './ports/tenant-access-port.js';

export class LoadAuthorizedConversationService {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly conversations: ConversationRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly permission: string;
  }): Promise<{ actor: ConversationActor; conversation: Conversation }> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    ConversationPolicy.assertPermission(actor.permissions, input.permission);

    const conversation = await this.conversations.findById(
      actor.tenantId,
      createConversationId(input.conversationId),
    );
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    return { actor, conversation };
  }
}
