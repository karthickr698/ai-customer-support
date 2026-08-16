import { AGENT_PRESENCE_STATUSES, type AgentPresenceStatus } from '@ai-customer-support/contracts';
import type { Conversation } from '../domain/conversation.js';
import { toConversationDto } from './dtos.js';
import type { AgentAvailabilityPort } from './ports/agent-availability-port.js';
import type { UserDirectoryPort } from './ports/user-directory-port.js';

export function parsePresenceStatus(value: string | undefined): AgentPresenceStatus | null {
  if (!value) {
    return null;
  }

  return (AGENT_PRESENCE_STATUSES as readonly string[]).includes(value)
    ? (value as AgentPresenceStatus)
    : null;
}

export async function toConversationDtoWithAssignee(
  conversation: Conversation,
  users: UserDirectoryPort,
  availability?: AgentAvailabilityPort,
) {
  const agentId = conversation.assignedAgentId;
  if (!agentId) {
    return toConversationDto(conversation, null);
  }

  const [assignee, snapshot] = await Promise.all([
    users.findById(agentId),
    availability
      ? availability.get(conversation.organizationId, agentId)
      : Promise.resolve(undefined),
  ]);

  return toConversationDto(conversation, assignee, parsePresenceStatus(snapshot?.status));
}
