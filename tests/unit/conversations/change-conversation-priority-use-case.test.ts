import type { EventBus } from '@ai-customer-support/shared';
import { describe, expect, it } from 'vitest';
import { LoadAuthorizedConversationService } from '../../../apps/api/src/modules/conversations/application/load-authorized-conversation-service.ts';
import type { ClockPort } from '../../../apps/api/src/modules/conversations/application/ports/clock-port.ts';
import type { ConversationRepository } from '../../../apps/api/src/modules/conversations/application/ports/conversation-repository.ts';
import type { TenantAccessPort } from '../../../apps/api/src/modules/conversations/application/ports/tenant-access-port.ts';
import type { UserDirectoryPort } from '../../../apps/api/src/modules/conversations/application/ports/user-directory-port.ts';
import { ChangeConversationPriorityUseCase } from '../../../apps/api/src/modules/conversations/application/use-cases/change-conversation-priority-use-case.ts';
import { Conversation } from '../../../apps/api/src/modules/conversations/domain/conversation.ts';
import type { ConversationId } from '../../../apps/api/src/modules/conversations/domain/conversation-id.ts';
import { CustomerContact } from '../../../apps/api/src/modules/conversations/domain/customer-contact.ts';
import { InsufficientConversationPermissionError } from '../../../apps/api/src/modules/conversations/domain/errors.ts';

const now = new Date('2026-08-15T12:00:00.000Z');
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

class MemoryEvents implements EventBus {
  readonly names: string[] = [];
  async publish(event: { eventName: string }): Promise<void> {
    this.names.push(event.eventName);
  }
  subscribe(): void {}
}

const clock: ClockPort = { now: () => now };
const users: UserDirectoryPort = {
  findById: async () => null,
};

function createConversation() {
  return Conversation.create({
    organizationId: tenantId,
    customer: CustomerContact.parse({ email: 'pat@example.com', name: 'Pat Customer' }),
    subject: 'Refund request',
    now,
  });
}

function tenantAccess(permissions: readonly string[]): TenantAccessPort {
  return {
    loadActor: async () => ({ tenantId, actorId, permissions }),
  };
}

function useCase(conversation: Conversation, permissions: readonly string[] = ['conversation.write']) {
  const conversations = new MemoryConversations(conversation);
  const events = new MemoryEvents();
  const authorized = new LoadAuthorizedConversationService(tenantAccess(permissions), conversations);
  const changePriority = new ChangeConversationPriorityUseCase(
    authorized,
    conversations,
    users,
    clock,
    events,
  );
  return {
    events,
    execute: changePriority.execute.bind(changePriority),
  };
}

describe('ChangeConversationPriorityUseCase', () => {
  it('updates priority and publishes ConversationPriorityChanged', async () => {
    const conversation = createConversation();
    const { events, execute } = useCase(conversation);

    const result = await execute({
      tenantId,
      actorId,
      conversationId: conversation.id,
      priority: 'urgent',
      security: {
        ipAddress: '127.0.0.1',
        requestId: 'req-1',
      },
    });

    expect(result.conversation.priority).toBe('urgent');
    expect(events.names).toEqual(['ConversationPriorityChanged']);
  });

  it('does not publish when priority is unchanged', async () => {
    const conversation = createConversation();
    conversation.changePriority('normal', now);
    const { events, execute } = useCase(conversation);

    const result = await execute({
      tenantId,
      actorId,
      conversationId: conversation.id,
      priority: 'normal',
      security: {
        ipAddress: '127.0.0.1',
        requestId: 'req-1',
      },
    });

    expect(result.conversation.priority).toBe('normal');
    expect(events.names).toEqual([]);
  });

  it('rejects actors without conversation.write', async () => {
    const conversation = createConversation();
    const { execute } = useCase(conversation, ['conversation.read']);

    await expect(
      execute({
        tenantId,
        actorId,
        conversationId: conversation.id,
        priority: 'high',
        security: {
          ipAddress: '127.0.0.1',
          requestId: 'req-1',
        },
      }),
    ).rejects.toBeInstanceOf(InsufficientConversationPermissionError);
  });
});
