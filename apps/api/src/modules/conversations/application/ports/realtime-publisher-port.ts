import type { RealtimeEphemeralMessage, RealtimeSupportEvent } from '@ai-customer-support/contracts';

export interface RealtimePublisherPort {
  publish(event: RealtimeSupportEvent): Promise<void>;
}

export interface RealtimeEphemeralPublisherPort {
  publish(message: RealtimeEphemeralFanout): Promise<void>;
}

export type RealtimeEphemeralFanout = RealtimeEphemeralMessage & {
  readonly tenantId: string;
  readonly senderId?: string;
};

export interface RealtimeEventLogPort {
  append(event: RealtimeSupportEvent): Promise<RealtimeSupportEvent>;
  replay(
    tenantId: string,
    afterEventId: string | undefined,
    limit: number,
  ): Promise<{
    readonly events: RealtimeSupportEvent[];
    readonly lastEventId: string | null;
    readonly resyncRequired: boolean;
  }>;
}
