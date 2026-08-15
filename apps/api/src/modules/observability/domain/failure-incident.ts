import type {
  ObservabilityIncidentSeverity,
  ObservabilityIncidentSource,
  ObservabilityIncidentStatus,
} from '@ai-customer-support/contracts';
import { InvalidIncidentStateError } from './errors.js';
import { createObservabilityIncidentId, type ObservabilityIncidentId } from './ids.js';
import { parseIncidentSeverity, parseIncidentSource, parseIncidentStatus } from './values.js';

export type ObservabilityIncidentSnapshot = {
  readonly id: ObservabilityIncidentId;
  readonly fingerprint: string;
  readonly title: string;
  readonly message: string;
  readonly source: ObservabilityIncidentSource;
  readonly severity: ObservabilityIncidentSeverity;
  readonly status: ObservabilityIncidentStatus;
  readonly organizationId?: string;
  readonly errorCode?: string;
  readonly route?: string;
  readonly count: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly acknowledgedAt?: Date;
  readonly acknowledgedBy?: string;
  readonly resolvedAt?: Date;
  readonly resolvedBy?: string;
};

export class ObservabilityIncident {
  private constructor(private snapshot: ObservabilityIncidentSnapshot) {}

  static open(input: {
    readonly id?: string;
    readonly fingerprint: string;
    readonly title: string;
    readonly message: string;
    readonly source: ObservabilityIncidentSource;
    readonly severity: ObservabilityIncidentSeverity;
    readonly organizationId?: string;
    readonly errorCode?: string;
    readonly route?: string;
    readonly now: Date;
  }): ObservabilityIncident {
    return new ObservabilityIncident({
      id: createObservabilityIncidentId(input.id),
      fingerprint: input.fingerprint,
      title: input.title.trim() || 'Failure detected',
      message: input.message.trim() || 'A failure was detected',
      source: parseIncidentSource(input.source),
      severity: parseIncidentSeverity(input.severity),
      status: 'open',
      organizationId: input.organizationId,
      errorCode: input.errorCode,
      route: input.route,
      count: 1,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
    });
  }

  static rehydrate(snapshot: ObservabilityIncidentSnapshot): ObservabilityIncident {
    return new ObservabilityIncident({
      ...snapshot,
      id: createObservabilityIncidentId(snapshot.id),
      source: parseIncidentSource(snapshot.source),
      severity: parseIncidentSeverity(snapshot.severity),
      status: parseIncidentStatus(snapshot.status),
    });
  }

  get id(): ObservabilityIncidentId {
    return this.snapshot.id;
  }

  get status(): ObservabilityIncidentStatus {
    return this.snapshot.status;
  }

  recordOccurrence(now: Date, severity: ObservabilityIncidentSeverity): void {
    if (this.snapshot.status === 'resolved') {
      this.snapshot = {
        ...this.snapshot,
        status: 'open',
        severity: parseIncidentSeverity(severity),
        count: this.snapshot.count + 1,
        lastSeenAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
        resolvedAt: undefined,
        resolvedBy: undefined,
      };
      return;
    }
    this.snapshot = {
      ...this.snapshot,
      severity: parseIncidentSeverity(severity),
      count: this.snapshot.count + 1,
      lastSeenAt: now,
    };
  }

  acknowledge(actorId: string, now: Date): void {
    if (this.snapshot.status === 'resolved') {
      throw new InvalidIncidentStateError('A resolved incident cannot be acknowledged');
    }
    this.snapshot = {
      ...this.snapshot,
      status: 'acknowledged',
      acknowledgedAt: now,
      acknowledgedBy: actorId,
    };
  }

  resolve(actorId: string, now: Date): void {
    if (this.snapshot.status === 'resolved') {
      throw new InvalidIncidentStateError('Incident is already resolved');
    }
    this.snapshot = {
      ...this.snapshot,
      status: 'resolved',
      resolvedAt: now,
      resolvedBy: actorId,
    };
  }

  toSnapshot(): ObservabilityIncidentSnapshot {
    return this.snapshot;
  }
}
