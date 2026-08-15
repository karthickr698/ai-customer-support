import type { AnalyticsMetric } from '@ai-customer-support/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';
import { MAX_AGENTS, MAX_TAG_BREAKDOWN, MAX_TOP_CUSTOMERS } from '../../../domain/analytics-policy.js';
import type { ReportingPeriod } from '../../../domain/reporting-period.js';
import type {
  AgentReportRow,
  AnalyticsQueryFilter,
  AnalyticsQueryPort,
  ConversationReportSnapshot,
  CustomerReportSnapshot,
  NamedCountRow,
  OverviewSnapshot,
  TicketReportSnapshot,
  TimeSeriesRow,
} from '../../../application/ports.js';

type CountRow = { readonly count: bigint | number | null };
type NamedRow = { readonly name: string; readonly count: bigint | number | null };
type AvgRow = { readonly avg_seconds: unknown };
type BucketRow = { readonly bucket: Date; readonly value: bigint | number | null };

const METRIC_QUERIES: Record<
  AnalyticsMetric,
  {
    readonly table: 'conversations' | 'tickets' | 'messages' | 'customers' | 'widget_sessions';
    readonly timeColumn: 'created_at' | 'updated_at' | 'resolved_at' | 'sla_breached_at';
    readonly extra?: Prisma.Sql;
  }
> = {
  'conversations.created': { table: 'conversations', timeColumn: 'created_at' },
  'conversations.resolved': {
    table: 'conversations',
    timeColumn: 'updated_at',
    extra: Prisma.sql`AND status IN ('resolved', 'closed')`,
  },
  'tickets.created': { table: 'tickets', timeColumn: 'created_at' },
  'tickets.resolved': {
    table: 'tickets',
    timeColumn: 'resolved_at',
    extra: Prisma.sql`AND resolved_at IS NOT NULL`,
  },
  'tickets.sla_breached': {
    table: 'tickets',
    timeColumn: 'sla_breached_at',
    extra: Prisma.sql`AND sla_breached_at IS NOT NULL`,
  },
  'messages.created': { table: 'messages', timeColumn: 'created_at' },
  'messages.customer': {
    table: 'messages',
    timeColumn: 'created_at',
    extra: Prisma.sql`AND m.author_type = 'customer'`,
  },
  'messages.agent': {
    table: 'messages',
    timeColumn: 'created_at',
    extra: Prisma.sql`AND m.author_type = 'agent'`,
  },
  'messages.ai': {
    table: 'messages',
    timeColumn: 'created_at',
    extra: Prisma.sql`AND m.author_type = 'ai'`,
  },
  'customers.created': { table: 'customers', timeColumn: 'created_at' },
  'widget.sessions_created': { table: 'widget_sessions', timeColumn: 'created_at' },
};

const TIME_COLUMNS = {
  created_at: Prisma.raw('created_at'),
  updated_at: Prisma.raw('updated_at'),
  resolved_at: Prisma.raw('resolved_at'),
  sla_breached_at: Prisma.raw('sla_breached_at'),
} as const;

const TABLES = {
  conversations: Prisma.raw('conversations'),
  tickets: Prisma.raw('tickets'),
  messages: Prisma.raw('messages'),
  customers: Prisma.raw('customers'),
  widget_sessions: Prisma.raw('widget_sessions'),
} as const;

export class PostgresAnalyticsQueryAdapter implements AnalyticsQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async loadOverview(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<OverviewSnapshot> {
    const org = orgSql(tenantId);
    const convWhere = conversationWhere(org, period, filter, 'created_at');
    const ticketRange = ticketWhere(org, period, filter, 'created_at');
    const messageJoin = messageWhere(org, period, filter);
    const [
      conversationsCreated,
      conversationsOpenNow,
      conversationsUnassignedNow,
      conversationsByStatus,
      conversationsByChannel,
      conversationFirstResponse,
      ticketsCreated,
      ticketsOpenNow,
      ticketsUnassignedNow,
      ticketsSlaBreached,
      ticketsByStatus,
      ticketsByPriority,
      ticketsBySource,
      ticketFirstResponse,
      ticketResolution,
      messagesCreated,
      messagesByAuthorType,
      customersCreated,
      customersTotal,
      knowledgeDocuments,
      knowledgeIndexed,
      widgetSessionsCreated,
    ] = await Promise.all([
      this.count(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM conversations WHERE ${convWhere}`),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM conversations WHERE organization_id = ${org} AND status IN ('open', 'pending', 'escalated') ${conversationFilterSql(filter)}`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM conversations WHERE organization_id = ${org} AND assigned_agent_id IS NULL AND status IN ('open', 'pending', 'escalated') ${conversationFilterSql(filter)}`,
      ),
      this.named(
        Prisma.sql`SELECT status AS name, COUNT(*)::bigint AS count FROM conversations WHERE ${convWhere} GROUP BY status ORDER BY count DESC`,
      ),
      this.named(
        Prisma.sql`SELECT channel AS name, COUNT(*)::bigint AS count FROM conversations WHERE ${convWhere} GROUP BY channel ORDER BY count DESC`,
      ),
      this.avg(conversationFirstResponseSql(org, period, filter)),
      this.count(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE ${ticketRange}`),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE organization_id = ${org} AND status IN ('open', 'pending', 'escalated') ${ticketFilterSql(filter)}`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE organization_id = ${org} AND assigned_agent_id IS NULL AND status IN ('open', 'pending', 'escalated') ${ticketFilterSql(filter)}`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE organization_id = ${org} AND sla_breached_at >= ${period.from} AND sla_breached_at < ${period.to} ${ticketFilterSql(filter)}`,
      ),
      this.named(
        Prisma.sql`SELECT status AS name, COUNT(*)::bigint AS count FROM tickets WHERE ${ticketRange} GROUP BY status ORDER BY count DESC`,
      ),
      this.named(
        Prisma.sql`SELECT priority AS name, COUNT(*)::bigint AS count FROM tickets WHERE ${ticketRange} GROUP BY priority ORDER BY count DESC`,
      ),
      this.named(
        Prisma.sql`SELECT source AS name, COUNT(*)::bigint AS count FROM tickets WHERE ${ticketRange} GROUP BY source ORDER BY count DESC`,
      ),
      this.avg(
        Prisma.sql`SELECT AVG(EXTRACT(EPOCH FROM (first_responded_at - created_at))) AS avg_seconds FROM tickets WHERE ${ticketRange} AND first_responded_at IS NOT NULL`,
      ),
      this.avg(
        Prisma.sql`SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS avg_seconds FROM tickets WHERE ${ticketRange} AND resolved_at IS NOT NULL`,
      ),
      this.count(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM messages m ${messageJoin}`),
      this.named(
        Prisma.sql`SELECT m.author_type AS name, COUNT(*)::bigint AS count FROM messages m ${messageJoin} GROUP BY m.author_type ORDER BY count DESC`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM customers WHERE organization_id = ${org} AND created_at >= ${period.from} AND created_at < ${period.to}`,
      ),
      this.count(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM customers WHERE organization_id = ${org}`),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM knowledge_documents WHERE organization_id = ${org}`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM knowledge_documents WHERE organization_id = ${org} AND indexed_at IS NOT NULL`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM widget_sessions WHERE organization_id = ${org} AND created_at >= ${period.from} AND created_at < ${period.to}`,
      ),
    ]);

    return {
      conversationsCreated,
      conversationsOpenNow,
      conversationsUnassignedNow,
      conversationsByStatus,
      conversationsByChannel,
      conversationAverageFirstResponseSeconds: conversationFirstResponse,
      ticketsCreated,
      ticketsOpenNow,
      ticketsUnassignedNow,
      ticketsSlaBreached,
      ticketsByStatus,
      ticketsByPriority,
      ticketsBySource,
      ticketAverageFirstResponseSeconds: ticketFirstResponse,
      ticketAverageResolutionSeconds: ticketResolution,
      messagesCreated,
      messagesByAuthorType,
      customersCreated,
      customersTotal,
      knowledgeDocuments,
      knowledgeIndexed,
      widgetSessionsCreated,
    };
  }

  async loadTimeSeries(
    tenantId: string,
    period: ReportingPeriod,
    metrics: readonly AnalyticsMetric[],
    filter?: AnalyticsQueryFilter,
  ): Promise<ReadonlyMap<AnalyticsMetric, readonly TimeSeriesRow[]>> {
    const org = orgSql(tenantId);
    const entries = await Promise.all(
      metrics.map(async (metric) => {
        const rows = await this.queryMetricSeries(org, period, metric, filter);
        return [metric, rows] as const;
      }),
    );
    return new Map(entries);
  }

  private async queryMetricSeries(
    org: Prisma.Sql,
    period: ReportingPeriod,
    metric: AnalyticsMetric,
    filter: AnalyticsQueryFilter | undefined,
  ): Promise<TimeSeriesRow[]> {
    const spec = METRIC_QUERIES[metric];
    const extra = spec.extra ?? Prisma.empty;
    const timeColumn =
      spec.table === 'messages' ? Prisma.raw('m.created_at') : TIME_COLUMNS[spec.timeColumn];
    const source = spec.table === 'messages' ? Prisma.raw('messages m') : TABLES[spec.table];
    const orgColumn = spec.table === 'messages' ? Prisma.raw('m.organization_id') : Prisma.raw('organization_id');
    const rows = await this.prisma.$queryRaw<BucketRow[]>`
      SELECT date_trunc(${period.granularity}, ${timeColumn}) AS bucket, COUNT(*)::bigint AS value
      FROM ${source}
      WHERE ${orgColumn} = ${org}
        AND ${timeColumn} >= ${period.from}
        AND ${timeColumn} < ${period.to}
        ${extra}
        ${metricFilterSql(spec.table, filter)}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((row) => ({ bucket: row.bucket, value: toCount(row.value) }));
  }

  async loadConversationReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<ConversationReportSnapshot> {
    const org = orgSql(tenantId);
    const where = conversationWhere(org, period, filter, 'created_at');
    const [created, byStatus, byChannel, byTag, unassigned, averageFirstResponseSeconds] = await Promise.all([
      this.count(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM conversations WHERE ${where}`),
      this.named(
        Prisma.sql`SELECT status AS name, COUNT(*)::bigint AS count FROM conversations WHERE ${where} GROUP BY status ORDER BY count DESC`,
      ),
      this.named(
        Prisma.sql`SELECT channel AS name, COUNT(*)::bigint AS count FROM conversations WHERE ${where} GROUP BY channel ORDER BY count DESC`,
      ),
      this.named(
        Prisma.sql`SELECT t.name AS name, COUNT(*)::bigint AS count
          FROM conversation_tags t
          INNER JOIN conversations c ON c.id = t.conversation_id
          WHERE c.organization_id = ${org}
            AND c.created_at >= ${period.from} AND c.created_at < ${period.to}
            ${conversationFilterSql(filter, 'c')}
          GROUP BY t.name
          ORDER BY count DESC
          LIMIT ${MAX_TAG_BREAKDOWN}`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM conversations WHERE ${where} AND assigned_agent_id IS NULL`,
      ),
      this.avg(conversationFirstResponseSql(org, period, filter)),
    ]);
    return { created, byStatus, byChannel, byTag, unassigned, averageFirstResponseSeconds };
  }

  async loadTicketReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<TicketReportSnapshot> {
    const org = orgSql(tenantId);
    const createdWhere = ticketWhere(org, period, filter, 'created_at');
    const [created, resolved, slaBreached, unassigned, byStatus, byPriority, bySource, first, resolution] =
      await Promise.all([
        this.count(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE ${createdWhere}`),
        this.count(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE organization_id = ${org} AND resolved_at >= ${period.from} AND resolved_at < ${period.to} ${ticketFilterSql(filter)}`,
        ),
        this.count(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE organization_id = ${org} AND sla_breached_at >= ${period.from} AND sla_breached_at < ${period.to} ${ticketFilterSql(filter)}`,
        ),
        this.count(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tickets WHERE ${createdWhere} AND assigned_agent_id IS NULL`,
        ),
        this.named(
          Prisma.sql`SELECT status AS name, COUNT(*)::bigint AS count FROM tickets WHERE ${createdWhere} GROUP BY status ORDER BY count DESC`,
        ),
        this.named(
          Prisma.sql`SELECT priority AS name, COUNT(*)::bigint AS count FROM tickets WHERE ${createdWhere} GROUP BY priority ORDER BY count DESC`,
        ),
        this.named(
          Prisma.sql`SELECT source AS name, COUNT(*)::bigint AS count FROM tickets WHERE ${createdWhere} GROUP BY source ORDER BY count DESC`,
        ),
        this.avg(
          Prisma.sql`SELECT AVG(EXTRACT(EPOCH FROM (first_responded_at - created_at))) AS avg_seconds FROM tickets WHERE ${createdWhere} AND first_responded_at IS NOT NULL`,
        ),
        this.avg(
          Prisma.sql`SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS avg_seconds FROM tickets WHERE ${createdWhere} AND resolved_at IS NOT NULL`,
        ),
      ]);
    return {
      created,
      resolved,
      slaBreached,
      unassigned,
      byStatus,
      byPriority,
      bySource,
      averageFirstResponseSeconds: first,
      averageResolutionSeconds: resolution,
    };
  }

  async loadAgentReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<readonly AgentReportRow[]> {
    const org = orgSql(tenantId);
    const rows = await this.prisma.$queryRaw<
      {
        readonly agent_id: string;
        readonly email: string | null;
        readonly display_name: string | null;
        readonly conversations_assigned: bigint | number | null;
        readonly conversations_resolved: bigint | number | null;
        readonly tickets_assigned: bigint | number | null;
        readonly tickets_resolved: bigint | number | null;
        readonly avg_first: unknown;
        readonly avg_resolution: unknown;
      }[]
    >`
      WITH conv AS (
        SELECT assigned_agent_id AS agent_id,
          COUNT(*)::bigint AS conversations_assigned,
          COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::bigint AS conversations_resolved
        FROM conversations
        WHERE organization_id = ${org}
          AND created_at >= ${period.from} AND created_at < ${period.to}
          AND assigned_agent_id IS NOT NULL
          ${conversationFilterSql(filter)}
        GROUP BY assigned_agent_id
      ),
      tix AS (
        SELECT assigned_agent_id AS agent_id,
          COUNT(*)::bigint AS tickets_assigned,
          COUNT(*) FILTER (
            WHERE resolved_at IS NOT NULL AND resolved_at >= ${period.from} AND resolved_at < ${period.to}
          )::bigint AS tickets_resolved,
          AVG(EXTRACT(EPOCH FROM (first_responded_at - created_at)))
            FILTER (WHERE first_responded_at IS NOT NULL) AS avg_first,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))
            FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution
        FROM tickets
        WHERE organization_id = ${org}
          AND created_at >= ${period.from} AND created_at < ${period.to}
          AND assigned_agent_id IS NOT NULL
          ${ticketFilterSql(filter)}
        GROUP BY assigned_agent_id
      )
      SELECT COALESCE(conv.agent_id, tix.agent_id) AS agent_id,
        u.email,
        u.display_name,
        COALESCE(conv.conversations_assigned, 0) AS conversations_assigned,
        COALESCE(conv.conversations_resolved, 0) AS conversations_resolved,
        COALESCE(tix.tickets_assigned, 0) AS tickets_assigned,
        COALESCE(tix.tickets_resolved, 0) AS tickets_resolved,
        tix.avg_first,
        tix.avg_resolution
      FROM conv
      FULL OUTER JOIN tix ON tix.agent_id = conv.agent_id
      LEFT JOIN users u ON u.id = COALESCE(conv.agent_id, tix.agent_id)
      ORDER BY tickets_assigned DESC, conversations_assigned DESC
      LIMIT ${MAX_AGENTS}
    `;
    return rows.map((row) => ({
      agentId: row.agent_id,
      email: row.email,
      displayName: row.display_name,
      conversationsAssigned: toCount(row.conversations_assigned),
      conversationsResolved: toCount(row.conversations_resolved),
      ticketsAssigned: toCount(row.tickets_assigned),
      ticketsResolved: toCount(row.tickets_resolved),
      averageTicketFirstResponseSeconds: toAvg(row.avg_first),
      averageTicketResolutionSeconds: toAvg(row.avg_resolution),
    }));
  }

  async loadCustomerReport(
    tenantId: string,
    period: ReportingPeriod,
    filter?: AnalyticsQueryFilter,
  ): Promise<CustomerReportSnapshot> {
    const org = orgSql(tenantId);
    const [created, withConversations, top] = await Promise.all([
      this.count(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM customers WHERE organization_id = ${org} AND created_at >= ${period.from} AND created_at < ${period.to}`,
      ),
      this.count(
        Prisma.sql`SELECT COUNT(DISTINCT customer_email)::bigint AS count FROM conversations WHERE organization_id = ${org} AND created_at >= ${period.from} AND created_at < ${period.to} ${conversationFilterSql(filter)}`,
      ),
      this.prisma.$queryRaw<
        {
          readonly customer_email: string;
          readonly customer_name: string;
          readonly conversations: bigint | number | null;
          readonly tickets: bigint | number | null;
          readonly last_seen_at: Date | null;
        }[]
      >`
        WITH conv AS (
          SELECT customer_email,
            MIN(customer_name) AS customer_name,
            COUNT(*)::bigint AS conversations,
            MAX(COALESCE(last_message_at, created_at)) AS last_seen_at
          FROM conversations
          WHERE organization_id = ${org}
            AND created_at >= ${period.from} AND created_at < ${period.to}
            ${conversationFilterSql(filter)}
          GROUP BY customer_email
        ),
        tix AS (
          SELECT customer_email, COUNT(*)::bigint AS tickets
          FROM tickets
          WHERE organization_id = ${org}
            AND created_at >= ${period.from} AND created_at < ${period.to}
            ${ticketFilterSql(filter)}
          GROUP BY customer_email
        )
        SELECT conv.customer_email,
          conv.customer_name,
          conv.conversations,
          COALESCE(tix.tickets, 0) AS tickets,
          conv.last_seen_at
        FROM conv
        LEFT JOIN tix ON tix.customer_email = conv.customer_email
        ORDER BY conversations DESC, tickets DESC
        LIMIT ${MAX_TOP_CUSTOMERS}
      `,
    ]);
    return {
      created,
      withConversations,
      topCustomers: top.map((row) => ({
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        conversations: toCount(row.conversations),
        tickets: toCount(row.tickets),
        lastSeenAt: row.last_seen_at?.toISOString() ?? null,
      })),
    };
  }

  private async count(query: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(query);
    return toCount(rows[0]?.count);
  }

  private async named(query: Prisma.Sql): Promise<NamedCountRow[]> {
    const rows = await this.prisma.$queryRaw<NamedRow[]>(query);
    return rows.map((row) => ({ name: row.name, count: toCount(row.count) }));
  }

  private async avg(query: Prisma.Sql): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<AvgRow[]>(query);
    return toAvg(rows[0]?.avg_seconds);
  }
}

function orgSql(tenantId: string): Prisma.Sql {
  return Prisma.sql`CAST(${tenantId} AS UUID)`;
}

function conversationWhere(
  org: Prisma.Sql,
  period: ReportingPeriod,
  filter: AnalyticsQueryFilter | undefined,
  timeColumn: 'created_at' | 'updated_at',
): Prisma.Sql {
  return Prisma.sql`organization_id = ${org} AND ${TIME_COLUMNS[timeColumn]} >= ${period.from} AND ${TIME_COLUMNS[timeColumn]} < ${period.to} ${conversationFilterSql(filter)}`;
}

function ticketWhere(
  org: Prisma.Sql,
  period: ReportingPeriod,
  filter: AnalyticsQueryFilter | undefined,
  timeColumn: 'created_at' | 'resolved_at' | 'sla_breached_at',
): Prisma.Sql {
  return Prisma.sql`organization_id = ${org} AND ${TIME_COLUMNS[timeColumn]} >= ${period.from} AND ${TIME_COLUMNS[timeColumn]} < ${period.to} ${ticketFilterSql(filter)}`;
}

function messageWhere(
  org: Prisma.Sql,
  period: ReportingPeriod,
  filter: AnalyticsQueryFilter | undefined,
): Prisma.Sql {
  if (!filter?.channel && !filter?.status && !filter?.assignedAgentId) {
    return Prisma.sql`WHERE m.organization_id = ${org} AND m.created_at >= ${period.from} AND m.created_at < ${period.to}`;
  }
  return Prisma.sql`INNER JOIN conversations c ON c.id = m.conversation_id
    WHERE m.organization_id = ${org}
      AND m.created_at >= ${period.from} AND m.created_at < ${period.to}
      ${conversationFilterSql(filter, 'c')}`;
}

function conversationFilterSql(filter: AnalyticsQueryFilter | undefined, alias?: 'c'): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (filter?.channel) {
    parts.push(
      alias === 'c'
        ? Prisma.sql`AND c.channel = ${filter.channel}`
        : Prisma.sql`AND channel = ${filter.channel}`,
    );
  }
  if (filter?.status) {
    parts.push(
      alias === 'c'
        ? Prisma.sql`AND c.status = ${filter.status}`
        : Prisma.sql`AND status = ${filter.status}`,
    );
  }
  if (filter?.assignedAgentId) {
    parts.push(
      alias === 'c'
        ? Prisma.sql`AND c.assigned_agent_id = CAST(${filter.assignedAgentId} AS UUID)`
        : Prisma.sql`AND assigned_agent_id = CAST(${filter.assignedAgentId} AS UUID)`,
    );
  }
  return parts.length === 0 ? Prisma.empty : Prisma.join(parts, ' ');
}

function ticketFilterSql(filter: AnalyticsQueryFilter | undefined): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (filter?.status) {
    parts.push(Prisma.sql`AND status = ${filter.status}`);
  }
  if (filter?.assignedAgentId) {
    parts.push(Prisma.sql`AND assigned_agent_id = CAST(${filter.assignedAgentId} AS UUID)`);
  }
  return parts.length === 0 ? Prisma.empty : Prisma.join(parts, ' ');
}

function metricFilterSql(
  table: keyof typeof TABLES,
  filter: AnalyticsQueryFilter | undefined,
): Prisma.Sql {
  if (table === 'conversations') {
    return conversationFilterSql(filter);
  }
  if (table === 'tickets') {
    return ticketFilterSql(filter);
  }
  if (table === 'messages') {
    if (!filter?.channel && !filter?.status && !filter?.assignedAgentId) {
      return Prisma.empty;
    }
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = m.conversation_id
        ${conversationFilterSql(filter, 'c')}
    )`;
  }
  return Prisma.empty;
}

function conversationFirstResponseSql(
  org: Prisma.Sql,
  period: ReportingPeriod,
  filter: AnalyticsQueryFilter | undefined,
): Prisma.Sql {
  return Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (reply.created_at - c.created_at))) AS avg_seconds
    FROM conversations c
    INNER JOIN LATERAL (
      SELECT m.created_at
      FROM messages m
      WHERE m.conversation_id = c.id AND m.author_type IN ('agent', 'ai')
      ORDER BY m.created_at
      LIMIT 1
    ) reply ON true
    WHERE c.organization_id = ${org}
      AND c.created_at >= ${period.from} AND c.created_at < ${period.to}
      ${conversationFilterSql(filter, 'c')}
  `;
}

function toCount(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function toAvg(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.round(numeric);
}
