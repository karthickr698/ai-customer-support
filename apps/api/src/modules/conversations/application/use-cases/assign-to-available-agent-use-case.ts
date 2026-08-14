import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AssignmentPolicy } from '../../domain/assignment-policy.js';
import { AgentAssignedEvent } from '../../domain/events.js';
import { NoAvailableAgentError } from '../../domain/errors.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { LoadAuthorizedConversationService } from '../load-authorized-conversation-service.js';
import type { AgentAvailabilityPort } from '../ports/agent-availability-port.js';
import type { AssignmentCursorPort } from '../ports/assignment-cursor-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { OrganizationMemberDirectoryPort } from '../ports/organization-member-directory-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export class AssignToAvailableAgentUseCase {
  constructor(
    private readonly authorized: LoadAuthorizedConversationService,
    private readonly conversations: ConversationRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
    private readonly cursor: AssignmentCursorPort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly security: RequestSecurityContext;
  }): Promise<{ conversation: ConversationDto }> {
    const { actor, conversation } = await this.authorized.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      permission: Permissions.CONVERSATION_ASSIGN,
    });

    const agentId = await pickAvailableAgent(
      actor.tenantId,
      this.members,
      this.availability,
      this.cursor,
      conversation.assignedAgentId,
    );
    if (!agentId) {
      throw new NoAvailableAgentError();
    }

    const now = this.clock.now();
    conversation.assignTo(agentId, now);
    await this.conversations.save(conversation);

    await this.eventBus.publish(
      new AgentAssignedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        agentId,
        actor.actorId,
        input.security.correlationId,
      ),
    );

    const assignee = await this.users.findById(agentId);
    return { conversation: toConversationDto(conversation, assignee) };
  }
}

export async function pickAvailableAgent(
  tenantId: string,
  members: OrganizationMemberDirectoryPort,
  availability: AgentAvailabilityPort,
  cursor: AssignmentCursorPort,
  excludeAgentId?: string,
): Promise<string | undefined> {
  const roster = await members.listActiveMembers(tenantId);
  const presence = await availability.list(
    tenantId,
    roster.map((member) => member.userId),
  );
  const byAgent = new Map(presence.map((item) => [item.agentId, item.status]));
  const available = AssignmentPolicy.availableAgentIds(
    roster.map((member) => ({
      userId: member.userId,
      role: member.role,
      presence: byAgent.get(member.userId) ?? 'offline',
    })),
  ).filter((agentId) => agentId !== excludeAgentId);

  return cursor.takeNext(tenantId, available);
}
