import type { DomainEvent } from '@ai-customer-support/shared';

export class AnalyticsReportExportedEvent implements DomainEvent {
  readonly eventName = 'AnalyticsReportExported';

  constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly tenantId: string,
    readonly report: string,
    readonly actorId: string,
    readonly from: string,
    readonly to: string,
    readonly correlationId?: string,
  ) {}
}
