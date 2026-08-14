import type { EventBus } from '@ai-customer-support/shared';
import {
  PRESENCE_OFFLINE_AFTER_MS,
  PRESENCE_RECONNECT_GRACE_MS,
} from '../../domain/presence-constants.js';
import type { AgentPresenceStorePort } from '../ports/agent-presence-store-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import { publishPresenceChanged } from './mutate-agent-presence-use-cases.js';

export class SweepStaleAgentPresenceUseCase {
  constructor(
    private readonly store: AgentPresenceStorePort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(): Promise<{ markedOffline: number }> {
    const now = this.clock.now();
    const tracked = await this.store.listNonOffline();
    let markedOffline = 0;

    for (const presence of tracked) {
      if (!presence.isStale(now, PRESENCE_OFFLINE_AFTER_MS, PRESENCE_RECONNECT_GRACE_MS)) {
        continue;
      }

      if (presence.markOffline(now)) {
        await this.store.save(presence);
        await publishPresenceChanged(this.eventBus, presence);
        markedOffline += 1;
      }
    }

    return { markedOffline };
  }
}
