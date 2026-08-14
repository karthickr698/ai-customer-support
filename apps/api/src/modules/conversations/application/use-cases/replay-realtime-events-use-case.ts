import type { RealtimeEventListResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { ConversationPolicy } from '../../domain/conversation-policy.js';
import { REALTIME_REPLAY_LIMIT } from '../../domain/support-constants.js';
import type { RealtimeEventLogPort } from '../ports/realtime-publisher-port.js';
import type { TenantAccessPort } from '../ports/tenant-access-port.js';

export class ReplayRealtimeEventsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly events: RealtimeEventLogPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly afterEventId?: string;
    readonly limit?: number;
  }): Promise<RealtimeEventListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    ConversationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_READ);

    const limit = Math.min(Math.max(input.limit ?? REALTIME_REPLAY_LIMIT, 1), REALTIME_REPLAY_LIMIT);
    const replayed = await this.events.replay(actor.tenantId, input.afterEventId, limit);
    return {
      items: replayed.events,
      lastEventId: replayed.lastEventId,
      resyncRequired: replayed.resyncRequired,
    };
  }
}
