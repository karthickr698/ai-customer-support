import type { RealtimeSupportEvent } from '@ai-customer-support/contracts';
import type { Redis } from 'ioredis';
import { REALTIME_STREAM_MAXLEN } from '../../../domain/support-constants.js';
import type {
  RealtimeEventLogPort,
  RealtimePublisherPort,
} from '../../../application/ports/realtime-publisher-port.js';

const FANOUT_CHANNEL = 'realtime:fanout';

export class RedisRealtimeEventLog implements RealtimeEventLogPort, RealtimePublisherPort {
  constructor(private readonly redis: Redis) {}

  async append(event: RealtimeSupportEvent): Promise<RealtimeSupportEvent> {
    const streamId = await this.redis.xadd(
      streamKey(event.tenantId),
      'MAXLEN',
      '~',
      String(REALTIME_STREAM_MAXLEN),
      '*',
      'event',
      JSON.stringify(event),
    );

    return { ...event, eventId: streamId ?? event.eventId };
  }

  async publish(event: RealtimeSupportEvent): Promise<void> {
    const stored = await this.append(event);
    await this.redis.publish(FANOUT_CHANNEL, JSON.stringify(stored));
  }

  async replay(
    tenantId: string,
    afterEventId: string | undefined,
    limit: number,
  ): Promise<{
    readonly events: RealtimeSupportEvent[];
    readonly lastEventId: string | null;
    readonly resyncRequired: boolean;
  }> {
    const key = streamKey(tenantId);
    const lastId = await this.latestId(key);

    if (!afterEventId) {
      return { events: [], lastEventId: lastId, resyncRequired: false };
    }

    const first = await this.redis.xrange(key, '-', '+', 'COUNT', 1);
    const firstId = first[0]?.[0];
    if (firstId && compareStreamIds(firstId, afterEventId) > 0) {
      return { events: [], lastEventId: lastId, resyncRequired: true };
    }

    let range: [string, string[]][] = [];
    try {
      range = await this.redis.xrange(key, exclusive(afterEventId), '+', 'COUNT', limit);
    } catch {
      return { events: [], lastEventId: lastId, resyncRequired: true };
    }
    const events = range.flatMap((entry) => {
      const mapped = readEntry(entry);
      return mapped ? [mapped] : [];
    });

    return {
      events,
      lastEventId: events.at(-1)?.eventId ?? lastId,
      resyncRequired: false,
    };
  }

  private async latestId(key: string): Promise<string | null> {
    const last = await this.redis.xrevrange(key, '+', '-', 'COUNT', 1);
    return last[0]?.[0] ?? null;
  }
}

export { FANOUT_CHANNEL };

function streamKey(tenantId: string): string {
  return `realtime:events:${tenantId}`;
}

function exclusive(eventId: string): string {
  return `(${eventId}`;
}

function readEntry(entry: [string, string[]]): RealtimeSupportEvent | undefined {
  const [id, fields] = entry;
  const index = fields.findIndex((field) => field === 'event');
  const raw = index >= 0 ? fields[index + 1] : undefined;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as RealtimeSupportEvent;
    return { ...parsed, eventId: id };
  } catch {
    return undefined;
  }
}

function compareStreamIds(left: string, right: string): number {
  const [leftMs, leftSeq] = parseStreamId(left);
  const [rightMs, rightSeq] = parseStreamId(right);
  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }

  return leftSeq - rightSeq;
}

function parseStreamId(value: string): [number, number] {
  const [ms, seq] = value.split('-');
  return [Number(ms) || 0, Number(seq) || 0];
}
