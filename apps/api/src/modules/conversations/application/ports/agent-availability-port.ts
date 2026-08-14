export type AgentAvailabilitySnapshot = {
  readonly agentId: string;
  readonly status: string;
  readonly connectionCount: number;
};

export interface AgentAvailabilityPort {
  get(tenantId: string, agentId: string): Promise<AgentAvailabilitySnapshot>;
  list(tenantId: string, agentIds: readonly string[]): Promise<AgentAvailabilitySnapshot[]>;
}
