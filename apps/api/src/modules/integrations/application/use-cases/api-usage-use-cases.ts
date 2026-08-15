import type { PageRequest } from '@ai-customer-support/shared';
import type {
  PublicApiAuthKind,
  PublicApiUsageListResponse,
  PublicApiUsageSummaryResponse,
} from '@ai-customer-support/contracts';
import { PublicApiUsageRecord } from '../../domain/api-usage-record.js';
import { InvalidApiUsageError } from '../../domain/errors.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { toApiUsageRecordDto } from '../dtos.js';
import type {
  ApiUsageRepository,
  ClockPort,
  TenantAccessPort,
} from '../ports.js';

const DEFAULT_USAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export class RecordApiUsageUseCase {
  constructor(
    private readonly usage: ApiUsageRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId?: string;
    readonly authKind: PublicApiAuthKind;
    readonly credentialId?: string;
    readonly method: string;
    readonly path: string;
    readonly statusCode: number;
    readonly durationMs: number;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  }): Promise<void> {
    const record = PublicApiUsageRecord.create({
      organizationId: input.tenantId,
      actorId: input.actorId,
      authKind: input.authKind,
      credentialId: input.credentialId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      occurredAt: this.clock.now(),
    });
    await this.usage.save(record);
  }
}

export class ListApiUsageUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly usage: ApiUsageRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly method?: string;
    readonly route?: string;
    readonly statusCode?: number;
    readonly authKind?: string;
    readonly credentialId?: string;
    readonly from?: string;
    readonly to?: string;
  }): Promise<PublicApiUsageListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanListAudit(actor.permissions);
    const page = await this.usage.listByTenant(actor.tenantId, input.page, {
      method: input.method,
      route: input.route,
      statusCode: input.statusCode,
      authKind: input.authKind,
      credentialId: input.credentialId,
      from: parseOptionalDate(input.from, 'from'),
      to: parseOptionalDate(input.to, 'to'),
    });
    return {
      items: page.items.map(toApiUsageRecordDto),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class GetApiUsageSummaryUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly usage: ApiUsageRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly from?: string;
    readonly to?: string;
  }): Promise<PublicApiUsageSummaryResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanListAudit(actor.permissions);
    const to = parseOptionalDate(input.to, 'to') ?? this.clock.now();
    const from = parseOptionalDate(input.from, 'from') ?? new Date(to.getTime() - DEFAULT_USAGE_WINDOW_MS);
    if (from.getTime() > to.getTime()) {
      throw new InvalidApiUsageError('from must be before to');
    }
    const summary = await this.usage.summarize(actor.tenantId, from, to);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalRequests: summary.totalRequests,
      errorCount: summary.errorCount,
      averageDurationMs: summary.averageDurationMs,
      byRoute: summary.byRoute,
      byStatus: summary.byStatus.map((row) => ({
        statusClass: row.statusClass,
        count: row.count,
      })),
      byAuthKind: summary.byAuthKind.map((row) => ({
        authKind: row.authKind as PublicApiAuthKind,
        count: row.count,
      })),
      byDay: summary.byDay,
    };
  }
}

function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidApiUsageError(`${field} must be an ISO-8601 timestamp`);
  }
  return parsed;
}
