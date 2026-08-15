import type { EventBus } from '@ai-customer-support/shared';
import type {
  AgentAnalyticsResponse,
  AnalyticsCsvExportDto,
  AnalyticsOverviewResponse,
  AnalyticsTimeSeriesResponse,
  ConversationAnalyticsResponse,
  CustomerAnalyticsResponse,
  TicketAnalyticsResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AnalyticsPolicy } from '../../domain/analytics-policy.js';
import { AnalyticsReportExportedEvent } from '../../domain/events.js';
import { parseReport } from '../../domain/values.js';
import { encodeCsv } from '../csv.js';
import type { AnalyticsQueryInput, RequestSecurityContext } from '../dtos.js';
import type { ClockPort, TenantAccessPort } from '../ports.js';
import { GetAnalyticsOverviewUseCase } from './get-analytics-overview-use-case.js';
import { GetAnalyticsTimeSeriesUseCase } from './get-analytics-time-series-use-case.js';
import {
  GetAgentAnalyticsUseCase,
  GetConversationAnalyticsUseCase,
  GetCustomerAnalyticsUseCase,
  GetTicketAnalyticsUseCase,
} from './report-use-cases.js';

export class ExportAnalyticsReportUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly overview: GetAnalyticsOverviewUseCase,
    private readonly timeseries: GetAnalyticsTimeSeriesUseCase,
    private readonly conversations: GetConversationAnalyticsUseCase,
    private readonly tickets: GetTicketAnalyticsUseCase,
    private readonly agents: GetAgentAnalyticsUseCase,
    private readonly customers: GetCustomerAnalyticsUseCase,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    input: AnalyticsQueryInput & {
      readonly report: string;
      readonly metrics?: readonly string[];
      readonly security: RequestSecurityContext;
    },
  ): Promise<AnalyticsCsvExportDto> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AnalyticsPolicy.assertPermission(actor.permissions, Permissions.ANALYTICS_VIEW);
    const report = parseReport(input.report);
    const query = {
      tenantId: input.tenantId,
      actorId: input.actorId,
      from: input.from,
      to: input.to,
      granularity: input.granularity,
      channel: input.channel,
      status: input.status,
      assignedAgentId: input.assignedAgentId,
    };

    let body: string;
    if (report === 'overview') {
      body = overviewCsv(await this.overview.execute(query));
    } else if (report === 'timeseries') {
      body = timeseriesCsv(await this.timeseries.execute({ ...query, metrics: input.metrics }));
    } else if (report === 'conversations') {
      body = conversationCsv(await this.conversations.execute(query));
    } else if (report === 'tickets') {
      body = ticketCsv(await this.tickets.execute(query));
    } else if (report === 'agents') {
      body = agentCsv(await this.agents.execute(query));
    } else {
      body = customerCsv(await this.customers.execute(query));
    }

    const dateStamp = this.clock.now().toISOString().slice(0, 10);
    const filename = `analytics-${report}-${dateStamp}.csv`;
    await this.eventBus.publish(
      new AnalyticsReportExportedEvent(
        crypto.randomUUID(),
        this.clock.now(),
        actor.tenantId,
        report,
        actor.actorId,
        input.from ?? '',
        input.to ?? '',
        input.security.correlationId,
      ),
    );
    return {
      report,
      filename,
      contentType: 'text/csv; charset=utf-8',
      body,
    };
  }
}

function overviewCsv(data: AnalyticsOverviewResponse): string {
  const rows: (readonly (string | number | null)[])[] = [
    ['period.from', data.period.from],
    ['period.to', data.period.to],
    ['period.granularity', data.period.granularity],
    ['conversations.created', data.conversations.created],
    ['conversations.openNow', data.conversations.openNow],
    ['conversations.unassignedNow', data.conversations.unassignedNow],
    ['conversations.averageFirstResponseSeconds', data.conversations.averageFirstResponseSeconds],
    ['tickets.created', data.tickets.created],
    ['tickets.openNow', data.tickets.openNow],
    ['tickets.unassignedNow', data.tickets.unassignedNow],
    ['tickets.slaBreached', data.tickets.slaBreached],
    ['tickets.averageFirstResponseSeconds', data.tickets.averageFirstResponseSeconds],
    ['tickets.averageResolutionSeconds', data.tickets.averageResolutionSeconds],
    ['messages.created', data.messages.created],
    ['customers.created', data.customers.created],
    ['customers.total', data.customers.total],
    ['knowledge.documents', data.knowledge.documents],
    ['knowledge.indexed', data.knowledge.indexed],
    ['widget.sessionsCreated', data.widget.sessionsCreated],
    ...namedRows('conversations.status', data.conversations.byStatus),
    ...namedRows('conversations.channel', data.conversations.byChannel),
    ...namedRows('tickets.status', data.tickets.byStatus),
    ...namedRows('tickets.priority', data.tickets.byPriority),
    ...namedRows('tickets.source', data.tickets.bySource),
    ...namedRows('messages.authorType', data.messages.byAuthorType),
  ];
  return encodeCsv(['metric', 'value'], rows);
}

function timeseriesCsv(data: AnalyticsTimeSeriesResponse): string {
  const rows = data.series.flatMap((series) =>
    series.points.map((point) => [series.metric, point.bucket, point.value] as const),
  );
  return encodeCsv(['metric', 'bucket', 'value'], rows);
}

function conversationCsv(data: ConversationAnalyticsResponse): string {
  const rows: (readonly (string | number | null)[])[] = [
    ['created', data.created],
    ['unassigned', data.unassigned],
    ['averageFirstResponseSeconds', data.averageFirstResponseSeconds],
    ...namedRows('status', data.byStatus),
    ...namedRows('channel', data.byChannel),
    ...namedRows('tag', data.byTag),
  ];
  return encodeCsv(['metric', 'value'], rows);
}

function ticketCsv(data: TicketAnalyticsResponse): string {
  const rows: (readonly (string | number | null)[])[] = [
    ['created', data.created],
    ['resolved', data.resolved],
    ['slaBreached', data.slaBreached],
    ['unassigned', data.unassigned],
    ['averageFirstResponseSeconds', data.averageFirstResponseSeconds],
    ['averageResolutionSeconds', data.averageResolutionSeconds],
    ...namedRows('status', data.byStatus),
    ...namedRows('priority', data.byPriority),
    ...namedRows('source', data.bySource),
  ];
  return encodeCsv(['metric', 'value'], rows);
}

function agentCsv(data: AgentAnalyticsResponse): string {
  return encodeCsv(
    [
      'agentId',
      'email',
      'displayName',
      'conversationsAssigned',
      'conversationsResolved',
      'ticketsAssigned',
      'ticketsResolved',
      'averageTicketFirstResponseSeconds',
      'averageTicketResolutionSeconds',
    ],
    data.agents.map((agent) => [
      agent.agentId,
      agent.email,
      agent.displayName,
      agent.conversationsAssigned,
      agent.conversationsResolved,
      agent.ticketsAssigned,
      agent.ticketsResolved,
      agent.averageTicketFirstResponseSeconds,
      agent.averageTicketResolutionSeconds,
    ]),
  );
}

function customerCsv(data: CustomerAnalyticsResponse): string {
  const summary = encodeCsv(
    ['metric', 'value'],
    [
      ['created', data.created],
      ['withConversations', data.withConversations],
    ],
  );
  const top = encodeCsv(
    ['customerEmail', 'customerName', 'conversations', 'tickets', 'lastSeenAt'],
    data.topCustomers.map((customer) => [
      customer.customerEmail,
      customer.customerName,
      customer.conversations,
      customer.tickets,
      customer.lastSeenAt,
    ]),
  );
  return `${summary}\r\n${top}`;
}

function namedRows(
  prefix: string,
  rows: readonly { readonly name: string; readonly count: number }[],
): (readonly [string, number])[] {
  return rows.map((row) => [`${prefix}.${row.name}`, row.count]);
}
