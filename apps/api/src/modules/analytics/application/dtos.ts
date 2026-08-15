export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export type AnalyticsQueryInput = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly from?: string;
  readonly to?: string;
  readonly granularity?: string;
  readonly channel?: string;
  readonly status?: string;
  readonly assignedAgentId?: string;
};
