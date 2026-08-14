import { InvalidPresenceStatusError } from './errors.js';

export const AGENT_PRESENCE_STATUSES = ['online', 'away', 'busy', 'offline'] as const;
export type AgentPresenceStatus = (typeof AGENT_PRESENCE_STATUSES)[number];
export type ExplicitAgentPresenceStatus = Exclude<AgentPresenceStatus, 'offline'>;

export function isAgentPresenceStatus(value: string): value is AgentPresenceStatus {
  return (AGENT_PRESENCE_STATUSES as readonly string[]).includes(value);
}

export function parseExplicitPresenceStatus(value: string): ExplicitAgentPresenceStatus {
  if (value === 'online' || value === 'away' || value === 'busy') {
    return value;
  }

  throw new InvalidPresenceStatusError();
}

export function isAvailableForAssignment(status: AgentPresenceStatus): boolean {
  return status === 'online';
}
