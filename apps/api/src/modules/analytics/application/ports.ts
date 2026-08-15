import type {
  AgentAnalyticsRowDto,
  AnalyticsMetric,
  AnalyticsNamedCountDto,
  ConversationAnalyticsResponse,
  CustomerAnalyticsRowDto,
  TicketAnalyticsResponse,
} from '@ai-customer-support/contracts';
import type { ReportingPeriod } from '../domain/reporting-period.js';

export type AnalyticsActor = {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
};

export interface TenantAccessPort {
  loadActor(tenantId: string, actorId: string): Promise<AnalyticsActor>;
}

export interface ClockPort {
  now(): Date;
}

export type AnalyticsQueryFilter = {
  readonly channel?: string;
  readonly status?: string;
  readonly assignedAgentId?: string;
};

export type NamedCountRow = AnalyticsNamedCountDto;

export type TimeSeriesRow = {
  readonly bucket: Date;
  readonly value: number;
};

export type OverviewSnapshot = {
  readonly conversationsCreated: number;
  readonly conversationsOpenNow: number;
  readonly conversationsUnassignedNow: number;
  readonly conversationsByStatus: readonly NamedCountRow[];
  readonly conversationsByChannel: readonly NamedCountRow[];
  readonly conversationAverageFirstResponseSeconds: number | null;
  readonly ticketsCreated: number;
  readonly ticketsOpenNow: number;
  readonly ticketsUnassignedNow: number;
  readonly ticketsSlaBreached: number;
  readonly ticketsByStatus: readonly NamedCountRow[];
  readonly ticketsByPriority: readonly NamedCountRow[];
  readonly ticketsBySource: readonly NamedCountRow[];
  readonly ticketAverageFirstResponseSeconds: number | null;
  readonly ticketAverageResolutionSeconds: number | null;
  readonly messagesCreated: number;
  readonly messagesByAuthorType: readonly NamedCountRow[];
  readonly customersCreated: number;
  readonly customersTotal: number;
  readonly knowledgeDocuments: number;
  readonly knowledgeIndexed: number;
  readonly widgetSessionsCreated: number;
};

export type ConversationReportSnapshot = Omit<ConversationAnalyticsResponse, 'period'>;

export type TicketReportSnapshot = Omit<TicketAnalyticsResponse, 'period'>;

export type AgentReportRow = AgentAnalyticsRowDto;

export type CustomerReportSnapshot = {
  readonly created: number;
  readonly withConversations: number;
  readonly topCustomers: readonly CustomerAnalyticsRowDto[];
};

export interface AnalyticsQueryPort {
  loadOverview(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<OverviewSnapshot>;
  loadTimeSeries(
    tenantId: string,
    period: ReportingPeriod,
    metrics: readonly AnalyticsMetric[],
    filter?: AnalyticsQueryFilter,
  ): Promise<ReadonlyMap<AnalyticsMetric, readonly TimeSeriesRow[]>>;
  loadConversationReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<ConversationReportSnapshot>;
  loadTicketReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<TicketReportSnapshot>;
  loadAgentReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<readonly AgentReportRow[]>;
  loadCustomerReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<CustomerReportSnapshot>;
}
