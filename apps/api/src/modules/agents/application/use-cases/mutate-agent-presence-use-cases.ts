import type { EventBus } from '@ai-customer-support/shared';
import { AgentPresence } from '../../domain/agent-presence.js';
import { AgentPresenceChangedEvent } from '../../domain/events.js';
import { MAX_WEBSOCKET_CONNECTIONS_PER_AGENT } from '../../domain/presence-constants.js';
import { TooManyRealtimeConnectionsError } from '../../domain/errors.js';
import { parseExplicitPresenceStatus, type ExplicitAgentPresenceStatus } from '../../domain/presence-status.js';
import type { AgentPresenceStorePort } from '../ports/agent-presence-store-port.js';
import type { ClockPort } from '../ports/clock-port.js';

export class ConnectAgentPresenceUseCase {
  constructor(
    private readonly store: AgentPresenceStorePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly agentId: string;
    readonly correlationId?: string;
  }): Promise<{ connectionCount: number; statusChanged: boolean }> {
    const now = this.clock.now();
    const current = (await this.store.get(input.tenantId, input.agentId)) ?? AgentPresence.offline(input.tenantId, input.agentId, now);
    if (current.connectionCount >= MAX_WEBSOCKET_CONNECTIONS_PER_AGENT) {
      throw new TooManyRealtimeConnectionsError();
    }

    const previousStatus = current.status;
    current.connect(now);
    await this.store.save(current);

    const statusChanged = previousStatus !== current.status;
    if (statusChanged) {
      await publishPresenceChanged(this.eventBus, current, input.correlationId);
    }

    return { connectionCount: current.connectionCount, statusChanged };
  }
}

export class DisconnectAgentPresenceUseCase {
  constructor(
    private readonly store: AgentPresenceStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly tenantId: string; readonly agentId: string }): Promise<void> {
    const current = await this.store.get(input.tenantId, input.agentId);
    if (!current) {
      return;
    }

    current.disconnect(this.clock.now());
    await this.store.save(current);
  }
}

export class HeartbeatAgentPresenceUseCase {
  constructor(
    private readonly store: AgentPresenceStorePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly agentId: string;
    readonly correlationId?: string;
  }): Promise<void> {
    const now = this.clock.now();
    const current = (await this.store.get(input.tenantId, input.agentId)) ?? AgentPresence.offline(input.tenantId, input.agentId, now);
    const previousStatus = current.status;
    current.heartbeat(now);
    await this.store.save(current);

    if (previousStatus !== current.status) {
      await publishPresenceChanged(this.eventBus, current, input.correlationId);
    }
  }
}

export class SetAgentPresenceStatusUseCase {
  constructor(
    private readonly store: AgentPresenceStorePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly agentId: string;
    readonly status: ExplicitAgentPresenceStatus | string;
    readonly correlationId?: string;
  }): Promise<AgentPresence> {
    const now = this.clock.now();
    const status = parseExplicitPresenceStatus(input.status);
    const current = (await this.store.get(input.tenantId, input.agentId)) ?? AgentPresence.offline(input.tenantId, input.agentId, now);
    const previousStatus = current.status;
    current.setStatus(status, now);
    await this.store.save(current);

    if (previousStatus !== current.status) {
      await publishPresenceChanged(this.eventBus, current, input.correlationId);
    }

    return current;
  }
}

export async function publishPresenceChanged(
  eventBus: EventBus,
  presence: AgentPresence,
  correlationId?: string,
): Promise<void> {
  await eventBus.publish(
    new AgentPresenceChangedEvent(
      crypto.randomUUID(),
      presence.updatedAt,
      presence.tenantId,
      presence.agentId,
      presence.status,
      presence.connectionCount,
      correlationId,
    ),
  );
}
