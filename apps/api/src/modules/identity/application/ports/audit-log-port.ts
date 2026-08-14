export type AuditLogRecord = {
  readonly actorId?: string;
  readonly action: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
};

export interface AuditLogPort {
  record(entry: AuditLogRecord): Promise<void>;
}
