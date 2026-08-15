import type { ConversationListResponse } from '@ai-customer-support/contracts';
import type { PageRequest } from '@ai-customer-support/shared';
import { Permissions } from '../../../organizations/domain/permissions.js';
import type { ConversationChannel } from '../../domain/conversation-channel.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import type { ConversationPriority } from '../../domain/conversation-priority.js';
import type { ConversationStatus } from '../../domain/conversation-status.js';
import { ConversationTag } from '../../domain/conversation-tag.js';
import { toConversationDto } from '../dtos.js';
import type { ConversationRepository } from '../ports/conversation-repository.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';
import type { UserDirectoryPort } from '../ports/user-directory-port.js';

export type ListConversationsQuery = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly page: PageRequest;
  readonly query?: string;
  readonly status?: ConversationStatus;
  readonly priority?: ConversationPriority;
  readonly channel?: ConversationChannel;
  readonly assignedAgentId?: string | 'unassigned';
  readonly tag?: string;
};

export class ListConversationsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly conversations: ConversationRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(query: ListConversationsQuery): Promise<ConversationListResponse> {
    const actor = await this.tenantAccess.loadActor(query.tenantId, query.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_READ);

    const tag = query.tag ? ConversationTag.parse(query.tag).value : undefined;
    const result = await this.conversations.search(
      {
        tenantId: actor.tenantId,
        query: query.query,
        status: query.status,
        priority: query.priority,
        channel: query.channel,
        assignedAgentId: query.assignedAgentId,
        tag,
      },
      query.page,
    );

    const items = [];
    for (const conversation of result.items) {
      const assignee = conversation.assignedAgentId
        ? await this.users.findById(conversation.assignedAgentId)
        : null;
      items.push(toConversationDto(conversation, assignee));
    }

    return {
      items,
      total: result.total,
      page: query.page.page,
      pageSize: query.page.pageSize,
    };
  }
}
