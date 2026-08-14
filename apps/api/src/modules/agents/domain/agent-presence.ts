import {
  isAvailableForAssignment,
  parseExplicitPresenceStatus,
  type AgentPresenceStatus,
  type ExplicitAgentPresenceStatus,
} from './presence-status.js';

export type AgentPresenceSnapshot = {
  readonly tenantId: string;
  readonly agentId: string;
  readonly status: AgentPresenceStatus;
  readonly lastHeartbeatAt: Date | undefined;
  readonly connectionCount: number;
  readonly updatedAt: Date;
};

export class AgentPresence {
  private constructor(
    readonly tenantId: string,
    readonly agentId: string,
    private statusValue: AgentPresenceStatus,
    private lastHeartbeatAtValue: Date | undefined,
    private connectionCountValue: number,
    private updatedAtValue: Date,
  ) {}

  static offline(tenantId: string, agentId: string, now: Date): AgentPresence {
    return new AgentPresence(tenantId, agentId, 'offline', undefined, 0, now);
  }

  static reconstitute(snapshot: AgentPresenceSnapshot): AgentPresence {
    return new AgentPresence(
      snapshot.tenantId,
      snapshot.agentId,
      snapshot.status,
      snapshot.lastHeartbeatAt,
      snapshot.connectionCount,
      snapshot.updatedAt,
    );
  }

  get status(): AgentPresenceStatus {
    return this.statusValue;
  }

  get lastHeartbeatAt(): Date | undefined {
    return this.lastHeartbeatAtValue;
  }

  get connectionCount(): number {
    return this.connectionCountValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get isOnlineForAssignment(): boolean {
    return isAvailableForAssignment(this.statusValue) && this.connectionCountValue > 0;
  }

  setStatus(status: ExplicitAgentPresenceStatus, now: Date): void {
    this.statusValue = parseExplicitPresenceStatus(status);
    this.updatedAtValue = now;
    this.lastHeartbeatAtValue = now;
  }

  heartbeat(now: Date): void {
    this.lastHeartbeatAtValue = now;
    this.updatedAtValue = now;
    if (this.statusValue === 'offline') {
      this.statusValue = 'online';
    }
  }

  connect(now: Date): void {
    this.connectionCountValue += 1;
    this.lastHeartbeatAtValue = now;
    this.updatedAtValue = now;
    if (this.statusValue === 'offline') {
      this.statusValue = 'online';
    }
  }

  disconnect(now: Date): void {
    this.connectionCountValue = Math.max(0, this.connectionCountValue - 1);
    this.updatedAtValue = now;
  }

  markOffline(now: Date): boolean {
    if (this.statusValue === 'offline' && this.connectionCountValue === 0) {
      return false;
    }

    this.statusValue = 'offline';
    this.connectionCountValue = 0;
    this.updatedAtValue = now;
    return true;
  }

  isStale(now: Date, offlineAfterMs: number, reconnectGraceMs: number): boolean {
    if (this.statusValue === 'offline') {
      return false;
    }

    const lastSeen = this.lastHeartbeatAtValue ?? this.updatedAtValue;
    const grace = this.connectionCountValue === 0 ? reconnectGraceMs : 0;
    return now.getTime() - lastSeen.getTime() > offlineAfterMs + grace;
  }

  toSnapshot(): AgentPresenceSnapshot {
    return {
      tenantId: this.tenantId,
      agentId: this.agentId,
      status: this.statusValue,
      lastHeartbeatAt: this.lastHeartbeatAtValue,
      connectionCount: this.connectionCountValue,
      updatedAt: this.updatedAtValue,
    };
  }
}
