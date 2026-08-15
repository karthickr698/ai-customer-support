import type { AnalyticsMetric, AnalyticsTimeSeriesResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AnalyticsPolicy } from '../../domain/analytics-policy.js';
import { alignSeries, ReportingPeriod } from '../../domain/reporting-period.js';
import {
  parseMetrics,
  parseOptionalChannel,
  parseOptionalStatus,
  parseOptionalUuid,
} from '../../domain/values.js';
import type { AnalyticsQueryInput } from '../dtos.js';
import type { AnalyticsQueryPort, ClockPort, TenantAccessPort } from '../ports.js';

export class GetAnalyticsTimeSeriesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly queries: AnalyticsQueryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: AnalyticsQueryInput & { readonly metrics?: readonly string[] },
  ): Promise<AnalyticsTimeSeriesResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    AnalyticsPolicy.assertPermission(actor.permissions, Permissions.ANALYTICS_VIEW);
    const period = ReportingPeriod.create({
      from: input.from,
      to: input.to,
      granularity: input.granularity,
      now: this.clock.now(),
    });
    const metrics = parseMetrics(input.metrics);
    const series = await this.queries.loadTimeSeries(actor.tenantId, period, metrics, {
      channel: parseOptionalChannel(input.channel),
      status: parseOptionalStatus(input.status),
      assignedAgentId: parseOptionalUuid(input.assignedAgentId, 'assignedAgentId'),
    });
    return {
      period: period.toDto(),
      series: metrics.map((metric: AnalyticsMetric) => ({
        metric,
        points: alignSeries(period.from, period.to, period.granularity, series.get(metric) ?? []),
      })),
    };
  }
}
