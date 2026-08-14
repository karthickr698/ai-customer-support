import { AgentPresence } from '../domain/agent-presence.js';
import type { AgentPresenceStorePort } from './ports/agent-presence-store-port.js';

export type AgentAvailabilitySnapshot = {
  readonly agentId: string;
  readonly status: string;
  readonly connectionCount: number;
};

export class AgentPresenceQuery {
  constructor(private readonly store: AgentPresenceStorePort) {}

  async get(tenantId: string, agentId: string): Promise<AgentAvailabilitySnapshot> {
    const presence = await this.store.get(tenantId, agentId);
    if (!presence) {
      return { agentId, status: 'offline', connectionCount: 0 };
    }

    return {
      agentId: presence.agentId,
      status: presence.status,
      connectionCount: presence.connectionCount,
    };
  }

  async list(tenantId: string, agentIds: readonly string[]): Promise<AgentAvailabilitySnapshot[]> {
    const stored = await this.store.list(tenantId, agentIds);
    const byAgent = new Map(stored.map((presence) => [presence.agentId, presence]));
    return agentIds.map((agentId) => {
      const presence = byAgent.get(agentId) ?? AgentPresence.offline(tenantId, agentId, new Date(0));
      return {
        agentId,
        status: presence.status,
        connectionCount: presence.connectionCount,
      };
    });
  }
}
