import type { Redis } from 'ioredis';
import { AgentPresence, type AgentPresenceSnapshot } from '../../../domain/agent-presence.js';
import type { AgentPresenceStatus } from '../../../domain/presence-status.js';
import type { AgentPresenceStorePort } from '../../../application/ports/agent-presence-store-port.js';

const INDEX_KEY = 'presence:index';

export class RedisAgentPresenceStore implements AgentPresenceStorePort {
  constructor(private readonly redis: Redis) {}

  async get(tenantId: string, agentId: string): Promise<AgentPresence | null> {
    const raw = await this.redis.get(presenceKey(tenantId, agentId));
    return raw ? deserialize(raw) : null;
  }

  async save(presence: AgentPresence): Promise<void> {
    const snapshot = presence.toSnapshot();
    const key = presenceKey(snapshot.tenantId, snapshot.agentId);
    const payload = JSON.stringify({
      tenantId: snapshot.tenantId,
      agentId: snapshot.agentId,
      status: snapshot.status,
      lastHeartbeatAt: snapshot.lastHeartbeatAt?.toISOString(),
      connectionCount: snapshot.connectionCount,
      updatedAt: snapshot.updatedAt.toISOString(),
    });

    const pipeline = this.redis.multi();
    pipeline.set(key, payload);
    if (snapshot.status === 'offline') {
      pipeline.srem(INDEX_KEY, memberId(snapshot.tenantId, snapshot.agentId));
    } else {
      pipeline.sadd(INDEX_KEY, memberId(snapshot.tenantId, snapshot.agentId));
    }

    await pipeline.exec();
  }

  async list(tenantId: string, agentIds: readonly string[]): Promise<AgentPresence[]> {
    if (agentIds.length === 0) {
      return [];
    }

    const values = await this.redis.mget(agentIds.map((agentId) => presenceKey(tenantId, agentId)));
    return values.flatMap((value) => (value ? [deserialize(value)] : []));
  }

  async listNonOffline(): Promise<AgentPresence[]> {
    const members = await this.redis.smembers(INDEX_KEY);
    if (members.length === 0) {
      return [];
    }

    const keys = members.map((member) => {
      const [tenantId, agentId] = member.split(':');
      return presenceKey(tenantId ?? '', agentId ?? '');
    });
    const values = await this.redis.mget(keys);
    return values.flatMap((value) => (value ? [deserialize(value)] : []));
  }
}

function presenceKey(tenantId: string, agentId: string): string {
  return `presence:${tenantId}:${agentId}`;
}

function memberId(tenantId: string, agentId: string): string {
  return `${tenantId}:${agentId}`;
}

function deserialize(raw: string): AgentPresence {
  const parsed = JSON.parse(raw) as {
    tenantId: string;
    agentId: string;
    status: AgentPresenceStatus;
    lastHeartbeatAt?: string;
    connectionCount: number;
    updatedAt: string;
  };

  const snapshot: AgentPresenceSnapshot = {
    tenantId: parsed.tenantId,
    agentId: parsed.agentId,
    status: parsed.status,
    lastHeartbeatAt: parsed.lastHeartbeatAt ? new Date(parsed.lastHeartbeatAt) : undefined,
    connectionCount: parsed.connectionCount,
    updatedAt: new Date(parsed.updatedAt),
  };

  return AgentPresence.reconstitute(snapshot);
}
