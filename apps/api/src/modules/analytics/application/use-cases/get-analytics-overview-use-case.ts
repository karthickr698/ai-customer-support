import type { AnalyticsOverviewResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AnalyticsPolicy } from '../../domain/analytics-policy.js';
import { ReportingPeriod } from '../../domain/reporting-period.js';
import { parseOptionalChannel, parseOptionalStatus, parseOptionalUuid } from '../../domain/values.js';
import type { AnalyticsQueryInput } from '../dtos.js';
import type { AnalyticsQueryPort, ClockPort, TenantAccessPort } from '../ports.js';

export class GetAnalyticsOverviewUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly queries: AnalyticsQueryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AnalyticsQueryInput): Promise<AnalyticsOverviewResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AnalyticsPolicy.assertPermission(actor.permissions, Permissions.ANALYTICS_VIEW);
    const period = ReportingPeriod.create({
      from: input.from,
      to: input.to,
      granularity: input.granularity,
      now: this.clock.now(),
    });
    const snapshot = await this.queries.loadOverview(actor.tenantId, period, {
      channel: parseOptionalChannel(input.channel),
      status: parseOptionalStatus(input.status),
      assignedAgentId: parseOptionalUuid(input.assignedAgentId, 'assignedAgentId'),
    });
    return {
      period: period.toDto(),
      conversations: {
        created: snapshot.conversationsCreated,
        openNow: snapshot.conversationsOpenNow,
        unassignedNow: snapshot.conversationsUnassignedNow,
        byStatus: snapshot.conversationsByStatus,
        byChannel: snapshot.conversationsByChannel,
        averageFirstResponseSeconds: snapshot.conversationAverageFirstResponseSeconds,
      },
      tickets: {
        created: snapshot.ticketsCreated,
        openNow: snapshot.ticketsOpenNow,
        unassignedNow: snapshot.ticketsUnassignedNow,
        slaBreached: snapshot.ticketsSlaBreached,
        byStatus: snapshot.ticketsByStatus,
        byPriority: snapshot.ticketsByPriority,
        bySource: snapshot.ticketsBySource,
        averageFirstResponseSeconds: snapshot.ticketAverageFirstResponseSeconds,
        averageResolutionSeconds: snapshot.ticketAverageResolutionSeconds,
      },
      messages: {
        created: snapshot.messagesCreated,
        byAuthorType: snapshot.messagesByAuthorType,
      },
      customers: {
        created: snapshot.customersCreated,
        total: snapshot.customersTotal,
      },
      knowledge: {
        documents: snapshot.knowledgeDocuments,
        indexed: snapshot.knowledgeIndexed,
      },
      widget: {
        sessionsCreated: snapshot.widgetSessionsCreated,
      },
    };
  }
}
