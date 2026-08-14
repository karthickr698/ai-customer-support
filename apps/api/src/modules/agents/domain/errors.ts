import { DomainError } from '@ai-customer-support/shared';

export class InvalidPresenceStatusError extends DomainError {
  readonly code = 'INVALID_PRESENCE_STATUS';

  constructor() {
    super('Presence status must be online, away, or busy', 400);
  }
}

export class AgentPresenceNotFoundError extends DomainError {
  readonly code = 'AGENT_PRESENCE_NOT_FOUND';

  constructor() {
    super('Agent presence was not found', 404);
  }
}

export class TooManyRealtimeConnectionsError extends DomainError {
  readonly code = 'TOO_MANY_REALTIME_CONNECTIONS';

  constructor() {
    super('Too many realtime connections for this agent', 429);
  }
}
