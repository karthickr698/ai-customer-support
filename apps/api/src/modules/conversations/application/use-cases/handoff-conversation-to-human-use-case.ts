import type { EventBus } from '@ai-customer-support/shared';
import { createConversationId } from '../../domain/conversation-id.js';
import { AgentAssignedEvent, ConversationEscalatedEvent } from '../../domain/events.js';
import { ConversationNotFoundError } from '../../domain/errors.js';
import { SYSTEM_ACTOR_ID } from '../../domain/support-constants.js';
import type { ConversationHandoffPort, ConversationHandoffResult } from '../ports/conversation-handoff-port.js';
import { recordCustomerVisibleSystemMessage } from '../record-system-message.js';
import type { AgentAvailabilityPort } from '../ports/agent-availability-port.js';
import type { AssignmentCursorPort } from '../ports/assignment-cursor-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';
import type { OrganizationMemberDirectoryPort } from '../ports/organization-member-directory-port.js';
import type { TicketIntakePort } from '../ports/ticket-intake-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';
import { pickAvailableAgent } from './assign-to-available-agent-use-case.js';

export class HandoffConversationToHumanUseCase implements ConversationHandoffPort {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
    private readonly cursor: AssignmentCursorPort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly ticketIntake?: TicketIntakePort,
  ) {}

  async handoffToHuman(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly conversationId: string;
    readonly reason?: string;
    readonly correlationId?: string;
  }): Promise<ConversationHandoffResult> {
    const conversation = await this.conversations.findById(
      input.tenantId,
      createConversationId(input.conversationId),
    );
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    const now = this.clock.now();
    const reason = input.reason?.trim() || 'Customer requested a human agent';

    if (conversation.assignedAgentId) {
      return {
        handedOff: true,
        conversationId: conversation.id,
        assignedAgentId: conversation.assignedAgentId,
        status: conversation.status,
        reason,
      };
    }

    const agentId = await pickAvailableAgent(
      input.tenantId,
      this.members,
      this.availability,
      this.cursor,
    );

    if (agentId) {
      conversation.assignTo(agentId, now);
      await this.conversations.save(conversation);
      await this.eventBus.publish(
        new AgentAssignedEvent(
          crypto.randomUUID(),
          now,
          input.tenantId,
          conversation.id,
          agentId,
          input.actorId,
          input.correlationId,
        ),
      );
      const assignee = await this.users.findById(agentId);
      await recordCustomerVisibleSystemMessage({
        conversations: this.conversations,
        messages: this.messages,
        eventBus: this.eventBus,
        conversation,
        tenantId: input.tenantId,
        body: `${assignee?.displayName ?? 'A teammate'} is joining the conversation.`,
        now,
        correlationId: input.correlationId,
      });

      return {
        handedOff: true,
        conversationId: conversation.id,
        assignedAgentId: agentId,
        status: conversation.status,
        reason,
      };
    }

    conversation.escalate(now);
    await this.conversations.save(conversation);
    await this.eventBus.publish(
      new ConversationEscalatedEvent(
        crypto.randomUUID(),
        now,
        input.tenantId,
        conversation.id,
        input.actorId,
        reason,
        input.correlationId,
      ),
    );
    await recordCustomerVisibleSystemMessage({
      conversations: this.conversations,
      messages: this.messages,
      eventBus: this.eventBus,
      conversation,
      tenantId: input.tenantId,
      body: 'A teammate will follow up shortly.',
      now,
      correlationId: input.correlationId,
    });
    await this.ticketIntake?.openFromConversation({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      customerEmail: conversation.customer.email,
      customerName: conversation.customer.name,
      customerId: conversation.customer.customerId,
      subject: conversation.subject,
      description: conversation.lastMessagePreview || reason,
      assignedAgentId: conversation.assignedAgentId,
      actorId: SYSTEM_ACTOR_ID,
      source: conversation.channel === 'widget' ? 'ai_conversation' : 'escalation',
      correlationId: input.correlationId,
    });

    return {
      handedOff: true,
      conversationId: conversation.id,
      assignedAgentId: null,
      status: conversation.status,
      reason,
    };
  }
}
