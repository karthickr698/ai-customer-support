import type { ConversationDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { Conversation } from '../../domain/conversation.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { ConversationTag } from '../../domain/conversation-tag.js';
import { CustomerContact } from '../../domain/customer-contact.js';
import {
  ConversationCreatedEvent,
  MessageReceivedEvent,
  MessageSentEvent,
} from '../../domain/events.js';
import { Message } from '../../domain/message.js';
import { AssigneeNotOrganizationMemberError } from '../../domain/errors.js';
import { toConversationDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { MessageRepository } from '../ports/message-repository.js';
import type { OrganizationMemberDirectoryPort } from '../ports/organization-member-directory-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export type CreateConversationCommand = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly customerId?: string;
  readonly subject?: string;
  readonly channel?: string;
  readonly priority?: string;
  readonly tags?: readonly string[];
  readonly assignedAgentId?: string;
  readonly initialMessage?: string;
  readonly initialMessageAuthor?: 'customer' | 'agent';
  readonly security: RequestSecurityContext;
};

export class CreateConversationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly members: OrganizationMemberDirectoryPort,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateConversationCommand): Promise<{ conversation: ConversationDto }> {
    const actor = await this.tenantAccess.loadActor(command.tenantId, command.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_WRITE);

    const now = this.clock.now();
    const conversation = Conversation.create({
      organizationId: actor.tenantId,
      customer: CustomerContact.parse({
        email: command.customerEmail,
        name: command.customerName,
        customerId: command.customerId,
      }),
      subject: command.subject,
      channel: command.channel,
      priority: command.priority,
      createdByUserId: actor.actorId,
      now,
    });

    for (const tag of command.tags ?? []) {
      conversation.addTag(ConversationTag.parse(tag), now);
    }

    if (command.assignedAgentId) {
      const member = await this.members.findActiveMember(actor.tenantId, command.assignedAgentId);
      if (!member) {
        throw new AssigneeNotOrganizationMemberError();
      }

      ConversationPolicy.assertAssignableRole(member.role);
      conversation.assignTo(member.userId, now);
    }

    let initial: Message | undefined;
    if (command.initialMessage) {
      initial = Message.create({
        conversationId: conversation.id,
        organizationId: actor.tenantId,
        authorType: command.initialMessageAuthor ?? 'customer',
        authorId: command.initialMessageAuthor === 'agent' ? actor.actorId : undefined,
        body: command.initialMessage,
        now,
      });
      conversation.recordMessage(initial, now);
    }

    await this.conversations.save(conversation);
    if (initial) {
      await this.messages.save(initial);
    }

    await this.eventBus.publish(
      new ConversationCreatedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        conversation.id,
        actor.actorId,
        command.security.correlationId,
      ),
    );

    if (initial) {
      if (initial.authorType === 'agent') {
        await this.eventBus.publish(
          new MessageSentEvent(
            crypto.randomUUID(),
            now,
            actor.tenantId,
            conversation.id,
            initial.id,
            actor.actorId,
            command.security.correlationId,
          ),
        );
      } else {
        await this.eventBus.publish(
          new MessageReceivedEvent(
            crypto.randomUUID(),
            now,
            actor.tenantId,
            conversation.id,
            initial.id,
            initial.authorType,
            command.security.correlationId,
          ),
        );
      }
    }

    const latest = (await this.conversations.findById(actor.tenantId, conversation.id)) ?? conversation;
    const assignee = latest.assignedAgentId
      ? await this.users.findById(latest.assignedAgentId)
      : null;

    return { conversation: toConversationDto(latest, assignee) };
  }
}
