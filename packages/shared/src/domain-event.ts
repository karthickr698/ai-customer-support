export interface DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly tenantId?: string;
  readonly correlationId?: string;
}
