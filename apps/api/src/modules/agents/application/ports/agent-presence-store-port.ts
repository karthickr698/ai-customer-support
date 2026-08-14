import type { AgentPresence } from '../../domain/agent-presence.js';

export interface AgentPresenceStorePort {
  get(tenantId: string, agentId: string): Promise<AgentPresence | null>;
  save(presence: AgentPresence): Promise<void>;
  list(tenantId: string, agentIds: readonly string[]): Promise<AgentPresence[]>;
  listNonOffline(): Promise<AgentPresence[]>;
}
