import type { EventBus, Page } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import { LoadAuthorizedConversationService } from '../../../apps/api/src/modules/conversations/application/load-authorized-conversation-service.ts';
import type { AgentAvailabilityPort } from '../../../apps/api/src/modules/conversations/application/ports/agent-availability-port.ts';
import type { ClockPort } from '../../../apps/api/src/modules/conversations/application/ports/clock-port.ts';
import type { ConversationRepository } from '../../../apps/api/src/modules/conversations/application/ports/conversation-repository.ts';
import type { MessageRepository } from '../../../apps/api/src/modules/conversations/application/ports/message-repository.ts';
import type { OrganizationMemberDirectoryPort } from '../../../apps/api/src/modules/conversations/application/ports/organization-member-directory-port.ts';
import type { TenantAccessPort } from '../../../apps/api/src/modules/conversations/application/ports/tenant-access-port.ts';
import type { UserDirectoryPort } from '../../../apps/api/src/modules/conversations/application/ports/user-directory-port.ts';
import { TakeOverConversationUseCase } from '../../../apps/api/src/modules/conversations/application/use-cases/take-over-conversation-use-case.ts';
import { Conversation } from '../../../apps/api/src/modules/conversations/domain/conversation.ts';
import type { ConversationId } from '../../../apps/api/src/modules/conversations/domain/conversation-id.ts';
import { CustomerContact } from '../../../apps/api/src/modules/conversations/domain/customer-contact.ts';
import { Message } from '../../../apps/api/src/modules/conversations/domain/message.ts';

const now = new Date('2026-08-16T12:00:00.000Z');
const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';

class MemoryConversations implements ConversationRepository {
  constructor(private conversation: Conversation) {}

  async findById(_tenantId: string, conversationId: ConversationId): Promise<Conversation | null> {
    return this.conversation.id === conversationId ? this.conversation : null;
  }

  async save(conversation: Conversation): Promise<void> {
    this.conversation = conversation;
  }

  async search(): Promise<{ readonly items: Conversation[]; readonly total: number }> {
    return { items: [this.conversation], total: 1 };
  }

  async listEscalationCandidates(): Promise<Conversation[]> {
    return [this.conversation];
  }
}

class MemoryMessages implements MessageRepository {
  readonly items: Message[] = [];

  async save(message: Message): Promise<void> {
    this.items.push(message);
  }

  async findById(): Promise<Message | null> {
    return this.items[0] ?? null;
  }

  async listByConversation(): Promise<Page<Message>> {
    return { items: this.items, total: this.items.length, page: 1, pageSize: 50 };
  }

  async listRecent(): Promise<Message[]> {
    return this.items;
  }
}

class MemoryEvents implements EventBus {
  readonly names: string[] = [];
  async publish(event: { eventName: string }): Promise<void> {
    this.names.push(event.eventName);
  }
  subscribe(): void {}
}

const clock: ClockPort = { now: () => now };
const users: UserDirectoryPort = {
  findById: async (id) => ({ id, email: 'alex@example.com', displayName: 'Alex Agent' }),
};
const members: OrganizationMemberDirectoryPort = {
  findActiveMember: async (_tenantId, userId) => ({ userId, role: 'agent' }),
  listActiveMembers: async () => [{ userId: actorId, role: 'agent' }],
};
const availability: AgentAvailabilityPort = {
  get: async (_tenantId, agentId) => ({ agentId, status: 'online', connectionCount: 1 }),
  list: async (_tenantId, agentIds) =>
    agentIds.map((agentId) => ({ agentId, status: 'online', connectionCount: 1 })),
};

function tenantAccess(permissions: readonly string[]): TenantAccessPort {
  return {
    loadActor: async () => ({ tenantId, actorId, permissions }),
  };
}

function useCase(conversation: Conversation) {
  const conversations = new MemoryConversations(conversation);
  const messages = new MemoryMessages();
  const events = new MemoryEvents();
  const takeover = new TakeOverConversationUseCase(
    new LoadAuthorizedConversationService(tenantAccess(['conversation.assign']), conversations),
    conversations,
    messages,
    members,
    users,
    availability,
    clock,
    events,
  );
  return { events, messages, execute: takeover.execute.bind(takeover) };
}

describe('TakeOverConversationUseCase', () => {
  it('assigns the actor, pauses AI, and writes a customer-visible join message', async () => {
    const conversation = Conversation.create({
      organizationId: tenantId,
      customer: CustomerContact.parse({ email: 'pat@example.com', name: 'Pat Customer' }),
      now,
    });
    const takeover = useCase(conversation);
    const result = await takeover.execute({
      tenantId,
      actorId,
      conversationId: conversation.id,
      security: {
        ipAddress: '127.0.0.1',
        requestId: 'req-1',
      },
    });

    expect(result.conversation.assignedAgentId).toBe(actorId);
    expect(result.conversation.handledBy).toBe('agent');
    expect(conversation.canGenerateAiReply()).toBe(false);
    expect(takeover.events.names).toContain('AgentAssigned');
    expect(takeover.events.names).toContain('MessageSent');
    expect(takeover.messages.items[0]?.authorType).toBe('system');
    expect(takeover.messages.items[0]?.body).toContain('Alex Agent');
  });

  it('is idempotent when the actor already owns the conversation', async () => {
    const conversation = Conversation.create({
      organizationId: tenantId,
      customer: CustomerContact.parse({ email: 'pat@example.com', name: 'Pat Customer' }),
      now,
    });
    conversation.assignTo(actorId, now);
    const takeover = useCase(conversation);
    await takeover.execute({
      tenantId,
      actorId,
      conversationId: conversation.id,
      security: { ipAddress: '127.0.0.1', requestId: 'req-1' },
    });

    expect(takeover.events.names).toEqual([]);
    expect(takeover.messages.items).toHaveLength(0);
  });
});
