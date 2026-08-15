import type {
  AgentAnalyticsResponse,
  ConversationAnalyticsResponse,
  CustomerAnalyticsResponse,
  TicketAnalyticsResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { AnalyticsPolicy } from '../../domain/analytics-policy.js';
import { ReportingPeriod } from '../../domain/reporting-period.js';
import { parseOptionalChannel, parseOptionalStatus, parseOptionalUuid } from '../../domain/values.js';
import type { AnalyticsQueryInput } from '../dtos.js';
import type { AnalyticsQueryPort, ClockPort, TenantAccessPort } from '../ports.js';

async function authorizePeriod(
  tenantAccess: TenantAccessPort,
  clock: ClockPort,
  input: AnalyticsQueryInput,
) {
  const actor = await tenantAccess.loadActor(input.tenantId, input.actorId);
  AnalyticsPolicy.assertPermission(actor.permissions, Permissions.ANALYTICS_VIEW);
  const period = ReportingPeriod.create({
    from: input.from,
    to: input.to,
    granularity: input.granularity,
    now: clock.now(),
  });
  const filter = {
    channel: parseOptionalChannel(input.channel),
    status: parseOptionalStatus(input.status),
    assignedAgentId: parseOptionalUuid(input.assignedAgentId, 'assignedAgentId'),
  };
  return { actor, period, filter };
}

export class GetConversationAnalyticsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly queries: AnalyticsQueryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AnalyticsQueryInput): Promise<ConversationAnalyticsResponse> {
    const { actor, period, filter } = await authorizePeriod(this.tenantAccess, this.clock, input);
    const report = await this.queries.loadConversationReport(actor.tenantId, period, filter);
    return { period: period.toDto(), ...report };
  }
}

export class GetTicketAnalyticsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly queries: AnalyticsQueryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AnalyticsQueryInput): Promise<TicketAnalyticsResponse> {
    const { actor, period, filter } = await authorizePeriod(this.tenantAccess, this.clock, input);
    const report = await this.queries.loadTicketReport(actor.tenantId, period, filter);
    return { period: period.toDto(), ...report };
  }
}

export class GetAgentAnalyticsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly queries: AnalyticsQueryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AnalyticsQueryInput): Promise<AgentAnalyticsResponse> {
    const { actor, period, filter } = await authorizePeriod(this.tenantAccess, this.clock, input);
    const agents = await this.queries.loadAgentReport(actor.tenantId, period, filter);
    return { period: period.toDto(), agents };
  }
}

export class GetCustomerAnalyticsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly queries: AnalyticsQueryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: AnalyticsQueryInput): Promise<CustomerAnalyticsResponse> {
    const { actor, period, filter } = await authorizePeriod(this.tenantAccess, this.clock, input);
    const report = await this.queries.loadCustomerReport(actor.tenantId, period, filter);
    return { period: period.toDto(), ...report };
  }
}
