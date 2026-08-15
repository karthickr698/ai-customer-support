export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
}
