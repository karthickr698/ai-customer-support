import type {
  ObservabilityAiEvaluationListResponse,
  ObservabilityAiEvaluationResponse,
  ObservabilityIncidentListResponse,
  ObservabilityIncidentResponse,
  ObservabilityLogListResponse,
  ObservabilityMetricsResponse,
  ObservabilityOverviewResponse,
  ObservabilityTraceDetailResponse,
  ObservabilityTraceListResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { PlatformPermissions } from '../../../platform/domain/permissions.js';
import {
  InsufficientObservabilityPermissionError,
  ObservabilityEvaluationNotFoundError,
  ObservabilityIncidentNotFoundError,
  ObservabilityTraceNotFoundError,
} from '../../domain/errors.js';
import {
  createObservabilityAiEvaluationId,
  createObservabilityIncidentId,
  createObservabilityTraceId,
} from '../../domain/ids.js';
import {
  parseEvaluationVerdict,
  parseIncidentSource,
  parseIncidentStatus,
  parseLogLevel,
  parseService,
  parseSpanStatus,
  requireUuid,
} from '../../domain/values.js';
import {
  defaultPeriod,
  parseIsoDate,
  toEvaluationDto,
  toIncidentDto,
  toLogDto,
  toMetricPointDto,
  toSpanDto,
  toTraceDto,
} from '../dtos.js';
import type {
  ClockPort,
  ObservabilityActor,
  ObservabilityAiEvaluationRepository,
  ObservabilityIncidentRepository,
  ObservabilityLogRepository,
  ObservabilityMetricRepository,
  ObservabilityTraceRepository,
  PlatformAccessPort,
  TenantAccessPort,
} from '../ports.js';

export type ObservabilityQueryScope = {
  readonly actorId: string;
  readonly organizationId?: string;
  readonly platform?: boolean;
};

export async function loadObservabilityActor(
  scope: ObservabilityQueryScope,
  platformAccess: PlatformAccessPort,
  tenantAccess: TenantAccessPort,
  permission: 'read' | 'manage',
): Promise<ObservabilityActor> {
  if (scope.platform) {
    const actor = await platformAccess.loadActor(scope.actorId);
    const required =
      permission === 'manage'
        ? PlatformPermissions.OBSERVABILITY_MANAGE
        : PlatformPermissions.OBSERVABILITY_READ;
    if (!actor.permissions.includes(required)) {
      throw new InsufficientObservabilityPermissionError(required);
    }
    return actor;
  }
  if (!scope.organizationId) {
    throw new InsufficientObservabilityPermissionError();
  }
  const actor = await tenantAccess.loadActor(scope.organizationId, scope.actorId);
  const required = permission === 'manage' ? Permissions.OBSERVABILITY_MANAGE : Permissions.OBSERVABILITY_VIEW;
  if (!actor.permissions.includes(required)) {
    throw new InsufficientObservabilityPermissionError(required);
  }
  return { ...actor, organizationId: actor.organizationId ?? scope.organizationId };
}

function tenantFilter(actor: ObservabilityActor, organizationId?: string): string | undefined {
  if (actor.organizationId) {
    return actor.organizationId;
  }
  return organizationId;
}

export class GetObservabilityOverviewUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly metrics: ObservabilityMetricRepository,
    private readonly traces: ObservabilityTraceRepository,
    private readonly incidents: ObservabilityIncidentRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: ObservabilityQueryScope & { readonly from?: string; readonly to?: string }): Promise<ObservabilityOverviewResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const organizationId = tenantFilter(actor, input.organizationId);
    const fallback = defaultPeriod(this.clock.now());
    const from = parseIsoDate(input.from, fallback.from);
    const to = parseIsoDate(input.to, fallback.to);
    const [summary, traceCounts, incidentCounts] = await Promise.all([
      this.metrics.summarize(organizationId, { from, to }),
      this.traces.count({ organizationId, from, to }),
      this.incidents.countByStatus(organizationId),
    ]);
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      requests: {
        total: summary.httpCount,
        errors: summary.httpErrors,
        errorRate: summary.httpCount > 0 ? summary.httpErrors / summary.httpCount : 0,
        averageLatencyMs: summary.httpCount > 0 ? summary.httpLatencySum / summary.httpCount : 0,
      },
      ai: {
        calls: summary.aiCount,
        errors: summary.aiErrors,
        promptTokens: summary.promptTokens,
        completionTokens: summary.completionTokens,
        evaluationsFailed: summary.evaluationsFailed,
        averageLatencyMs: summary.aiCount > 0 ? summary.aiLatencySum / summary.aiCount : 0,
      },
      traces: {
        total: traceCounts.total,
        errors: traceCounts.errors,
      },
      incidents: incidentCounts,
    };
  }
}

export class ListObservabilityLogsUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly logs: ObservabilityLogRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly page: number;
      readonly pageSize: number;
      readonly level?: string;
      readonly service?: string;
      readonly route?: string;
      readonly traceId?: string;
      readonly errorCode?: string;
      readonly from?: string;
      readonly to?: string;
    },
  ): Promise<ObservabilityLogListResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const fallback = defaultPeriod(this.clock.now());
    const result = await this.logs.list(
      { page: input.page, pageSize: input.pageSize },
      {
        organizationId: tenantFilter(actor, input.organizationId),
        level: input.level ? parseLogLevel(input.level) : undefined,
        service: input.service ? parseService(input.service) : undefined,
        route: input.route?.trim() || undefined,
        traceId: input.traceId?.trim() || undefined,
        errorCode: input.errorCode?.trim() || undefined,
        from: parseIsoDate(input.from, fallback.from),
        to: parseIsoDate(input.to, fallback.to),
      },
    );
    return {
      items: result.items.map(toLogDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class ListObservabilityTracesUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly traces: ObservabilityTraceRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly page: number;
      readonly pageSize: number;
      readonly status?: string;
      readonly service?: string;
      readonly from?: string;
      readonly to?: string;
    },
  ): Promise<ObservabilityTraceListResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const fallback = defaultPeriod(this.clock.now());
    const result = await this.traces.list(
      { page: input.page, pageSize: input.pageSize },
      {
        organizationId: tenantFilter(actor, input.organizationId),
        status: input.status ? parseSpanStatus(input.status) : undefined,
        service: input.service ? parseService(input.service) : undefined,
        from: parseIsoDate(input.from, fallback.from),
        to: parseIsoDate(input.to, fallback.to),
      },
    );
    return {
      items: result.items.map(toTraceDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class GetObservabilityTraceUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly traces: ObservabilityTraceRepository,
  ) {}

  async execute(
    input: ObservabilityQueryScope & { readonly traceId: string },
  ): Promise<ObservabilityTraceDetailResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const found = await this.traces.findById(
      createObservabilityTraceId(requireUuid(input.traceId, 'traceId')),
      tenantFilter(actor, input.organizationId),
    );
    if (!found) {
      throw new ObservabilityTraceNotFoundError();
    }
    return {
      trace: toTraceDto(found.trace),
      spans: found.spans.map(toSpanDto),
    };
  }
}

export class GetObservabilityMetricsUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly metrics: ObservabilityMetricRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly names?: readonly string[];
      readonly from?: string;
      readonly to?: string;
    },
  ): Promise<ObservabilityMetricsResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const fallback = defaultPeriod(this.clock.now());
    const from = parseIsoDate(input.from, fallback.from);
    const to = parseIsoDate(input.to, fallback.to);
    const samples = await this.metrics.list({
      organizationId: tenantFilter(actor, input.organizationId),
      names: input.names,
      from,
      to,
    });
    const grouped = new Map<string, ReturnType<typeof toMetricPointDto>[]>();
    for (const sample of samples) {
      const point = toMetricPointDto(sample);
      const key = `${point.name}|${JSON.stringify(point.labels)}`;
      const list = grouped.get(key) ?? [];
      list.push(point);
      grouped.set(key, list);
    }
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      series: [...grouped.values()].map((points) => ({
        name: points[0]?.name ?? '',
        labels: points[0]?.labels ?? {},
        points,
      })),
    };
  }
}

export class ListObservabilityIncidentsUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly incidents: ObservabilityIncidentRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly page: number;
      readonly pageSize: number;
      readonly status?: string;
      readonly source?: string;
      readonly from?: string;
      readonly to?: string;
    },
  ): Promise<ObservabilityIncidentListResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const fallback = defaultPeriod(this.clock.now());
    const result = await this.incidents.list(
      { page: input.page, pageSize: input.pageSize },
      {
        organizationId: tenantFilter(actor, input.organizationId),
        status: input.status ? parseIncidentStatus(input.status) : undefined,
        source: input.source ? parseIncidentSource(input.source) : undefined,
        from: parseIsoDate(input.from, fallback.from),
        to: parseIsoDate(input.to, fallback.to),
      },
    );
    return {
      items: result.items.map(toIncidentDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class GetObservabilityIncidentUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly incidents: ObservabilityIncidentRepository,
  ) {}

  async execute(
    input: ObservabilityQueryScope & { readonly incidentId: string },
  ): Promise<ObservabilityIncidentResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const incident = await this.incidents.findById(
      createObservabilityIncidentId(requireUuid(input.incidentId, 'incidentId')),
      tenantFilter(actor, input.organizationId),
    );
    if (!incident) {
      throw new ObservabilityIncidentNotFoundError();
    }
    return { incident: toIncidentDto(incident) };
  }
}

export class ListAiEvaluationsUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly evaluations: ObservabilityAiEvaluationRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly page: number;
      readonly pageSize: number;
      readonly verdict?: string;
      readonly operation?: string;
      readonly from?: string;
      readonly to?: string;
    },
  ): Promise<ObservabilityAiEvaluationListResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const fallback = defaultPeriod(this.clock.now());
    const result = await this.evaluations.list(
      { page: input.page, pageSize: input.pageSize },
      {
        organizationId: tenantFilter(actor, input.organizationId),
        verdict: input.verdict ? parseEvaluationVerdict(input.verdict) : undefined,
        operation: input.operation?.trim() || undefined,
        from: parseIsoDate(input.from, fallback.from),
        to: parseIsoDate(input.to, fallback.to),
      },
    );
    return {
      items: result.items.map(toEvaluationDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class GetAiEvaluationUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly evaluations: ObservabilityAiEvaluationRepository,
  ) {}

  async execute(
    input: ObservabilityQueryScope & { readonly evaluationId: string },
  ): Promise<ObservabilityAiEvaluationResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'read');
    const evaluation = await this.evaluations.findById(
      createObservabilityAiEvaluationId(requireUuid(input.evaluationId, 'evaluationId')),
      tenantFilter(actor, input.organizationId),
    );
    if (!evaluation) {
      throw new ObservabilityEvaluationNotFoundError();
    }
    return { evaluation: toEvaluationDto(evaluation) };
  }
}
