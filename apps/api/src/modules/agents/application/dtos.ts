import type { AgentPresenceDto } from '@ai-customer-support/contracts';
import type { AgentPresence } from '../domain/agent-presence.js';
import type { DirectoryUser } from './ports/user-directory-port.js';

export function toPresenceDto(
  presence: AgentPresence,
  member: { readonly role: string },
  user: DirectoryUser | null,
): AgentPresenceDto {
  const snapshot = presence.toSnapshot();
  return {
    agentId: snapshot.agentId,
    email: user?.email ?? '',
    displayName: user?.displayName ?? 'Unknown agent',
    role: member.role,
    status: snapshot.status,
    lastHeartbeatAt: snapshot.lastHeartbeatAt?.toISOString() ?? null,
    connectionCount: snapshot.connectionCount,
  };
}
