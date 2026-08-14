import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AgentAssignedEvent } from '../../domain/events.js';
import { AssigneeNotOrganizationMemberError } from '../../domain/errors.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { OrganizationMemberDirectoryPort } from '../ports/organization-member-directory-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class AssignConversationUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly conversations: ConversationRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly assignedAgentId: string;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_ASSIGN,
    });

    const member = await this.members.findActiveMember(actor.tenantId, input.assignedAgentId);
    if (!member) {
      throw new AssigneeNotOrganizationMemberError();
    }

    ConversationPolicy.assertAssignableRole(member.role);

    const now = this.clock.now();
    conversation.assignTo(member.userId, now);
    await this.conversations.save(conversation);

    await this.eventBus.publish(
      new AgentAssignedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        member.userId,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    const assignee = await this.users.findById(member.userId);
    return { conversation: toConversationDto(conversation, assignee) };
  }
}
