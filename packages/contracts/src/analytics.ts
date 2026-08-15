/**
 * Cross-runtime DTOs for tenant-scoped analytics aggregations, time-series, and CSV exports.
 */

export const ANALYTICS_GRANULARITIES = ['hour', 'day', 'week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export const ANALYTICS_METRICS = [
  'conversations.created',
  'conversations.resolved',
  'tickets.created',
  'tickets.resolved',
  'tickets.sla_breached',
  'messages.created',
  'messages.customer',
  'messages.agent',
  'messages.ai',
  'customers.created',
  'widget.sessions_created',
] as const;
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

export const ANALYTICS_REPORTS = [
  'overview',
  'timeseries',
  'conversations',
  'tickets',
  'agents',
  'customers',
] as const;
export type AnalyticsReport = (typeof ANALYTICS_REPORTS)[number];

export type AnalyticsPeriodDto = {
  readonly from: string;
  readonly to: string;
  readonly granularity: AnalyticsGranularity;
};

export type AnalyticsNamedCountDto = {
  readonly name: string;
  readonly count: number;
};

export type AnalyticsTimeSeriesPointDto = {
  readonly bucket: string;
  readonly value: number;
};

export type AnalyticsTimeSeriesDto = {
  readonly metric: AnalyticsMetric;
  readonly points: readonly AnalyticsTimeSeriesPointDto[];
};

export type AnalyticsOverviewResponse = {
  readonly period: AnalyticsPeriodDto;
  readonly conversations: {
    readonly created: number;
    readonly openNow: number;
    readonly unassignedNow: number;
    readonly byStatus: readonly AnalyticsNamedCountDto[];
    readonly byChannel: readonly AnalyticsNamedCountDto[];
    readonly averageFirstResponseSeconds: number | null;
  };
  readonly tickets: {
    readonly created: number;
    readonly openNow: number;
    readonly unassignedNow: number;
    readonly slaBreached: number;
    readonly byStatus: readonly AnalyticsNamedCountDto[];
    readonly byPriority: readonly AnalyticsNamedCountDto[];
    readonly bySource: readonly AnalyticsNamedCountDto[];
    readonly averageFirstResponseSeconds: number | null;
    readonly averageResolutionSeconds: number | null;
  };
  readonly messages: {
    readonly created: number;
    readonly byAuthorType: readonly AnalyticsNamedCountDto[];
  };
  readonly customers: {
    readonly created: number;
    readonly total: number;
  };
  readonly knowledge: {
    readonly documents: number;
    readonly indexed: number;
  };
  readonly widget: {
    readonly sessionsCreated: number;
  };
};

export type AnalyticsTimeSeriesResponse = {
  readonly period: AnalyticsPeriodDto;
  readonly series: readonly AnalyticsTimeSeriesDto[];
};

export type ConversationAnalyticsResponse = {
  readonly period: AnalyticsPeriodDto;
  readonly created: number;
  readonly byStatus: readonly AnalyticsNamedCountDto[];
  readonly byChannel: readonly AnalyticsNamedCountDto[];
  readonly byTag: readonly AnalyticsNamedCountDto[];
  readonly unassigned: number;
  readonly averageFirstResponseSeconds: number | null;
};

export type TicketAnalyticsResponse = {
  readonly period: AnalyticsPeriodDto;
  readonly created: number;
  readonly resolved: number;
  readonly slaBreached: number;
  readonly unassigned: number;
  readonly byStatus: readonly AnalyticsNamedCountDto[];
  readonly byPriority: readonly AnalyticsNamedCountDto[];
  readonly bySource: readonly AnalyticsNamedCountDto[];
  readonly averageFirstResponseSeconds: number | null;
  readonly averageResolutionSeconds: number | null;
};

export type AgentAnalyticsRowDto = {
  readonly agentId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly conversationsAssigned: number;
  readonly conversationsResolved: number;
  readonly ticketsAssigned: number;
  readonly ticketsResolved: number;
  readonly averageTicketFirstResponseSeconds: number | null;
  readonly averageTicketResolutionSeconds: number | null;
};

export type AgentAnalyticsResponse = {
  readonly period: AnalyticsPeriodDto;
  readonly agents: readonly AgentAnalyticsRowDto[];
};

export type CustomerAnalyticsRowDto = {
  readonly customerEmail: string;
  readonly customerName: string;
  readonly conversations: number;
  readonly tickets: number;
  readonly lastSeenAt: string | null;
};

export type CustomerAnalyticsResponse = {
  readonly period: AnalyticsPeriodDto;
  readonly created: number;
  readonly withConversations: number;
  readonly topCustomers: readonly CustomerAnalyticsRowDto[];
};

export type AnalyticsCsvExportDto = {
  readonly report: AnalyticsReport;
  readonly filename: string;
  readonly contentType: 'text/csv; charset=utf-8';
  readonly body: string;
};
