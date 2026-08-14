import type { AgentPresenceQuery } from '../../../../agents/application/agent-presence-query.js';
import type {
  AgentAvailabilityPort,
  AgentAvailabilitySnapshot,
} from '../../../application/ports/agent-availability-port.js';

export class AgentsAvailabilityAdapter implements AgentAvailabilityPort {
  constructor(private readonly presence: AgentPresenceQuery) {}

  get(tenantId: string, agentId: string): Promise<AgentAvailabilitySnapshot> {
    return this.presence.get(tenantId, agentId);
  }

  list(tenantId: string, agentIds: readonly string[]): Promise<AgentAvailabilitySnapshot[]> {
    return this.presence.list(tenantId, agentIds);
  }
}
