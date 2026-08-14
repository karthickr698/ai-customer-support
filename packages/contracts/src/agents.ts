export const AGENT_PRESENCE_STATUSES = ['online', 'away', 'busy', 'offline'] as const;
export type AgentPresenceStatus = (typeof AGENT_PRESENCE_STATUSES)[number];

export type AgentPresenceDto = {
  readonly agentId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly status: AgentPresenceStatus;
  readonly lastHeartbeatAt: string | null;
  readonly connectionCount: number;
};

export type AgentPresenceListResponse = {
  readonly items: readonly AgentPresenceDto[];
};

export type AgentPresenceResponse = {
  readonly presence: AgentPresenceDto;
};

export type SetAgentPresenceRequest = {
  readonly status: Exclude<AgentPresenceStatus, 'offline'>;
};
