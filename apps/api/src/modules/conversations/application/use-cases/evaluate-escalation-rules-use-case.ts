import type { EventBus, Logger } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { createConversationId } from '../../domain/conversation-id.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { EscalationPolicy, type EscalationRule } from '../../domain/escalation-rule.js';
import {
  AgentAssignedEvent,
  AgentUnassignedEvent,
  ConversationEscalatedEvent,
} from '../../domain/events.js';
import { SYSTEM_ACTOR_ID, MAX_ESCALATION_CANDIDATES } from '../../domain/support-constants.js';
import type { Conversation } from '../../domain/conversation.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { AgentAvailabilityPort } from '../ports/agent-availability-port.js';
import type { AssignmentCursorPort } from '../ports/assignment-cursor-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { EscalationRuleRepository } from '../ports/escalation-rule-repository.js';
import type { OrganizationMemberDirectoryPort } from '../ports/organization-member-directory-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { TicketIntakePort } from '../ports/ticket-intake-port.js';
import { pickAvailableAgent } from './assign-to-available-agent-use-case.js';

export type EvaluateEscalationCommand =
  | { readonly type: 'due'; readonly tenantId?: string; readonly actorId?: string }
  | {
      readonly type: 'message';
      readonly tenantId: string;
      readonly conversationId: string;
      readonly messageBody: string;
    }
  | { readonly type: 'agent_offline'; readonly tenantId: string; readonly agentId: string };

export class EvaluateEscalationRulesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly rules: EscalationRuleRepository,
    private readonly conversations: ConversationRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly availability: AgentAvailabilityPort,
    private readonly cursor: AssignmentCursorPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly logger?: Logger,
    private readonly ticketIntake?: TicketIntakePort,
  ) {}

  async execute(command: EvaluateEscalationCommand): Promise<{ applied: number }> {
    if (command.type === 'due') {
      if (command.actorId && command.tenantId) {
        const actor = await this.tenantAccess.loadActor(command.tenantId, command.actorId);
        ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_ESCALATE);
        return { applied: await this.evaluateTenant(actor.tenantId) };
      }

      const tenantIds = await this.rules.listTenantIdsWithEnabledRules();
      let applied = 0;
      for (const tenantId of tenantIds) {
        applied += await this.evaluateTenant(tenantId);
      }

      return { applied };
    }

    if (command.type === 'message') {
      const conversation = await this.conversations.findById(
        command.tenantId,
        createConversationId(command.conversationId),
      );
      if (!conversation) {
        return { applied: 0 };
      }

      return {
        applied: await this.applyFirstMatch(conversation, {
          now: this.clock.now(),
          messageBody: command.messageBody,
        }),
      };
    }

    const conversations = await this.conversations.listEscalationCandidates(command.tenantId, {
      assignedAgentId: command.agentId,
      limit: MAX_ESCALATION_CANDIDATES,
    });
    let applied = 0;
    for (const conversation of conversations) {
      applied += await this.applyFirstMatch(conversation, {
        now: this.clock.now(),
        assigneeOnline: false,
      });
    }

    return { applied };
  }

  private async evaluateTenant(tenantId: string): Promise<number> {
    const rules = await this.rules.listEnabled(tenantId);
    const timed = rules.filter((rule) => rule.isTimeBased || rule.trigger.type === 'assigned_agent_offline');
    if (timed.length === 0) {
      return 0;
    }

    const conversations = await this.conversations.listEscalationCandidates(tenantId, {
      limit: MAX_ESCALATION_CANDIDATES,
    });
    const now = this.clock.now();
    let applied = 0;

    for (const conversation of conversations) {
      const assigneeOnline = conversation.assignedAgentId
        ? (await this.availability.get(tenantId, conversation.assignedAgentId)).status === 'online'
        : undefined;
      applied += await this.applyFirstMatch(conversation, { now, assigneeOnline }, timed);
    }

    return applied;
  }

  private async applyFirstMatch(
    conversation: Conversation,
    context: { now: Date; messageBody?: string; assigneeOnline?: boolean },
    rules?: EscalationRule[],
  ): Promise<number> {
    const enabled = rules ?? (await this.rules.listEnabled(conversation.organizationId));
    const match = EscalationPolicy.firstMatch(enabled, conversation, context);
    if (!match) {
      return 0;
    }

    try {
      await this.apply(match, conversation, context.now);
      return 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown escalation error';
      this.logger?.warn('Escalation rule application failed', {
        tenantId: conversation.organizationId,
        conversationId: conversation.id,
        ruleId: match.id,
        message,
      });
      return 0;
    }
  }

  private async apply(rule: EscalationRule, conversation: Conversation, now: Date): Promise<void> {
    if (rule.action === 'assign_available') {
      const agentId = await pickAvailableAgent(
        conversation.organizationId,
        this.members,
        this.availability,
        this.cursor,
        conversation.assignedAgentId,
      );
      if (agentId) {
        conversation.assignTo(agentId, now);
        await this.conversations.save(conversation);
        await this.eventBus.publish(
          new AgentAssignedEvent(
            crypto.randomUUID(),
            now,
            conversation.organizationId,
            conversation.id,
            agentId,
            SYSTEM_ACTOR_ID,
          ),
        );
        return;
      }

      conversation.escalate(now);
      await this.conversations.save(conversation);
      await this.eventBus.publish(
        new ConversationEscalatedEvent(
          crypto.randomUUID(),
          now,
          conversation.organizationId,
          conversation.id,
          SYSTEM_ACTOR_ID,
          `No available agent; applied rule "${rule.name}"`,
        ),
      );
      await this.openTicket(conversation, `No available agent; applied rule "${rule.name}"`);
      return;
    }

    conversation.escalate(now);
    if (rule.action === 'escalate_and_unassign' && conversation.assignedAgentId) {
      conversation.unassign(now);
    }

    await this.conversations.save(conversation);
    await this.eventBus.publish(
      new ConversationEscalatedEvent(
        crypto.randomUUID(),
        now,
        conversation.organizationId,
        conversation.id,
        SYSTEM_ACTOR_ID,
        `Applied rule "${rule.name}"`,
      ),
    );

    if (rule.action === 'escalate_and_unassign') {
      await this.eventBus.publish(
        new AgentUnassignedEvent(
          crypto.randomUUID(),
          now,
          conversation.organizationId,
          conversation.id,
          SYSTEM_ACTOR_ID,
        ),
      );
    }

    await this.openTicket(conversation, `Applied rule "${rule.name}"`);
  }

  private async openTicket(conversation: Conversation, description: string): Promise<void> {
    await this.ticketIntake?.openFromConversation({
      tenantId: conversation.organizationId,
      conversationId: conversation.id,
      customerEmail: conversation.customer.email,
      customerName: conversation.customer.name,
      customerId: conversation.customer.customerId,
      subject: conversation.subject,
      description: conversation.lastMessagePreview || description,
      assignedAgentId: conversation.assignedAgentId,
      actorId: SYSTEM_ACTOR_ID,
      source: conversation.channel === 'widget' ? 'ai_conversation' : 'escalation',
    });
  }
}
