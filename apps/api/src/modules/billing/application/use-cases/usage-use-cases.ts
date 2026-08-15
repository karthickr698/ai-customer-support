import type { DomainEvent, EventBus } from '@ai-customer-support/shared';
import type {
  BillingQuotaCheckResponse,
  BillingUsageResponse,
} from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { BillingPolicy } from '../../domain/billing-policy.js';
import { USAGE_EVENT_METRICS, remainingQuota, wouldExceedQuota } from '../../domain/catalog.js';
import {
  QuotaExceededError,
  SubscriptionInactiveError,
} from '../../domain/errors.js';
import { QuotaExceededEvent, UsageRecordedEvent } from '../../domain/events.js';
import { BillingUsageRecord, usageIdempotencyKey } from '../../domain/usage-record.js';
import { parseUsageMetric } from '../../domain/values.js';
import type { RequestSecurityContext } from '../dtos.js';
import { emptyUsageTotals, toUsageItems, usedFor } from '../dtos.js';
import type {
  BillingPlanRepository,
  BillingSubscriptionRepository,
  BillingUsageRepository,
  ClockPort,
  TenantAccessPort,
} from '../ports.js';
import { loadSubscription } from './subscription-query-use-cases.js';

export class GetBillingUsageUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly usage: BillingUsageRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<BillingUsageResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_READ);
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const totals = await this.usage.sumByPeriod(
      actor.tenantId,
      subscription.id,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
    return {
      subscriptionId: subscription.id,
      periodStart: subscription.currentPeriodStart.toISOString(),
      periodEnd: subscription.currentPeriodEnd.toISOString(),
      items: toUsageItems(plan.quotas, totals),
    };
  }
}

export class CheckBillingQuotaUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly usage: BillingUsageRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly metric: string;
    readonly quantity?: number;
  }): Promise<BillingQuotaCheckResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_READ);
    const metric = parseUsageMetric(input.metric);
    const requested = input.quantity ?? 1;
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const totals = await this.usage.sumByPeriod(
      actor.tenantId,
      subscription.id,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
    const used = usedFor(totals, metric);
    const included = plan.quotas[metric].included;
    const allowed =
      subscription.allowsUsage && !wouldExceedQuota(included, used, requested);
    return {
      check: {
        metric,
        allowed,
        used,
        included,
        remaining: remainingQuota(included, used),
        requested,
        unlimited: included === null,
        subscriptionStatus: subscription.status,
      },
    };
  }
}

export class RecordBillingUsageUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly usage: BillingUsageRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly metric: string;
    readonly quantity?: number;
    readonly idempotencyKey?: string;
    readonly enforceQuota?: boolean;
    readonly security: RequestSecurityContext;
  }): Promise<BillingUsageResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    await this.record({
      tenantId: actor.tenantId,
      metric: input.metric,
      quantity: input.quantity ?? 1,
      source: 'manual',
      key: input.idempotencyKey?.trim() || input.security.requestId,
      enforceQuota: input.enforceQuota !== false,
      correlationId: input.security.correlationId,
    });
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const totals = await this.usage.sumByPeriod(
      actor.tenantId,
      subscription.id,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
    return {
      subscriptionId: subscription.id,
      periodStart: subscription.currentPeriodStart.toISOString(),
      periodEnd: subscription.currentPeriodEnd.toISOString(),
      items: toUsageItems(plan.quotas, totals),
    };
  }

  async record(input: {
    readonly tenantId: string;
    readonly metric: string;
    readonly quantity: number;
    readonly source: string;
    readonly key: string;
    readonly enforceQuota: boolean;
    readonly sourceEventId?: string;
    readonly correlationId?: string;
  }): Promise<boolean> {
    const metric = parseUsageMetric(input.metric);
    const subscription = await this.subscriptions.findByTenant(input.tenantId);
    if (!subscription || !subscription.belongsTo(input.tenantId)) {
      return false;
    }
    if (!subscription.allowsUsage) {
      if (input.enforceQuota) {
        throw new SubscriptionInactiveError(subscription.status);
      }
      return false;
    }
    const plan = await this.plans.findById(subscription.planId);
    if (!plan) {
      return false;
    }
    const now = this.clock.now();
    const totals = await this.usage.sumByPeriod(
      input.tenantId,
      subscription.id,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
    const used = usedFor(totals, metric);
    const included = plan.quotas[metric].included;
    if (input.enforceQuota && wouldExceedQuota(included, used, input.quantity)) {
      await this.eventBus.publish(
        new QuotaExceededEvent(
          crypto.randomUUID(),
          now,
          input.tenantId,
          subscription.id,
          metric,
          used,
          included,
          input.correlationId,
        ),
      );
      throw new QuotaExceededError(metric);
    }
    const record = BillingUsageRecord.create({
      organizationId: input.tenantId,
      subscriptionId: subscription.id,
      metric,
      quantity: input.quantity,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      source: input.source,
      idempotencyKey: usageIdempotencyKey(input.tenantId, metric, input.source, input.key),
      now,
      sourceEventId: input.sourceEventId,
    });
    const inserted = await this.usage.tryInsert(record);
    if (!inserted) {
      return false;
    }
    await this.eventBus.publish(
      new UsageRecordedEvent(
        crypto.randomUUID(),
        now,
        input.tenantId,
        subscription.id,
        metric,
        input.quantity,
        input.correlationId,
      ),
    );
    if (!input.enforceQuota && wouldExceedQuota(included, used, input.quantity)) {
      await this.eventBus.publish(
        new QuotaExceededEvent(
          crypto.randomUUID(),
          now,
          input.tenantId,
          subscription.id,
          metric,
          used + input.quantity,
          included,
          input.correlationId,
        ),
      );
    }
    return true;
  }
}

export class RecordEventUsageUseCase {
  constructor(private readonly recordUsage: RecordBillingUsageUseCase) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!event.tenantId) {
      return;
    }
    const metrics = metricsForEvent(event);
    for (const metric of metrics) {
      await this.recordUsage.record({
        tenantId: event.tenantId,
        metric,
        quantity: 1,
        source: 'event',
        key: `${event.eventId}:${metric}`,
        enforceQuota: false,
        sourceEventId: event.eventId,
        correlationId: event.correlationId,
      });
    }
  }
}

function metricsForEvent(event: DomainEvent): BillingUsageMetricList {
  const mapped = USAGE_EVENT_METRICS[event.eventName];
  const metrics: string[] = [];
  if (mapped) {
    metrics.push(mapped);
  }
  if (event.eventName === 'MessageReceived') {
    metrics.push('messages');
    const authorType = (event as { authorType?: unknown }).authorType;
    if (authorType === 'ai') {
      metrics.push('ai_replies');
    }
  }
  return metrics;
}

type BillingUsageMetricList = readonly string[];

export { emptyUsageTotals };
