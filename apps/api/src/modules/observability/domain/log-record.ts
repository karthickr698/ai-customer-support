import type { ObservabilityLogLevel, ObservabilityService } from '@ai-customer-support/contracts';
import { createObservabilityLogId, type ObservabilityLogId } from './ids.js';
import { parseLogLevel, parseService, redactAttributes } from './values.js';

export type ObservabilityLogSnapshot = {
  readonly id: ObservabilityLogId;
  readonly occurredAt: Date;
  readonly level: ObservabilityLogLevel;
  readonly service: ObservabilityService;
  readonly message: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly organizationId?: string;
  readonly actorId?: string;
  readonly method?: string;
  readonly path?: string;
  readonly route?: string;
  readonly statusCode?: number;
  readonly latencyMs?: number;
  readonly errorCode?: string;
  readonly attributes?: Record<string, unknown>;
};

export class ObservabilityLogRecord {
  private constructor(private readonly snapshot: ObservabilityLogSnapshot) {}

  static create(input: Omit<ObservabilityLogSnapshot, 'id'> & { readonly id?: string }): ObservabilityLogRecord {
    return new ObservabilityLogRecord({
      ...input,
      id: createObservabilityLogId(input.id),
      level: parseLogLevel(input.level),
      service: parseService(input.service),
      message: input.message.trim() || 'request',
      attributes: redactAttributes(input.attributes),
    });
  }

  static rehydrate(snapshot: ObservabilityLogSnapshot): ObservabilityLogRecord {
    return new ObservabilityLogRecord({
      ...snapshot,
      id: createObservabilityLogId(snapshot.id),
      level: parseLogLevel(snapshot.level),
      service: parseService(snapshot.service),
      attributes: redactAttributes(snapshot.attributes),
    });
  }

  toSnapshot(): ObservabilityLogSnapshot {
    return this.snapshot;
  }
}
