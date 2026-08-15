import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { BILLING_USAGE_METRICS } from '@ai-customer-support/contracts';
import type {
  BillingCheckoutSessionRepository,
  BillingInvoiceListFilter,
  BillingInvoiceRepository,
  BillingPaymentMethodRepository,
  BillingPlanRepository,
  BillingProviderEventRepository,
  BillingSubscriptionRepository,
  BillingUsageRepository,
  UsageTotals,
} from '../../../application/ports.js';
import { emptyUsageTotals } from '../../../application/dtos.js';
import { BillingPlan, type BillingPlanSnapshot } from '../../../domain/billing-plan.js';
import { parsePlanQuotas } from '../../../domain/catalog.js';
import { BillingCheckoutSession, type BillingCheckoutSessionSnapshot } from '../../../domain/checkout-session.js';
import {
  createBillingCheckoutSessionId,
  createBillingInvoiceId,
  createBillingInvoiceLineId,
  createBillingPaymentMethodId,
  createBillingPlanId,
  createBillingProviderEventId,
  createBillingSubscriptionId,
  type BillingCheckoutSessionId,
  type BillingInvoiceId,
  type BillingPlanId,
  type BillingSubscriptionId,
} from '../../../domain/ids.js';
import { BillingInvoice, type BillingInvoiceSnapshot } from '../../../domain/invoice.js';
import { BillingPaymentMethod, type BillingPaymentMethodSnapshot } from '../../../domain/payment-method.js';
import { BillingProviderEvent, type BillingProviderEventSnapshot } from '../../../domain/provider-event.js';
import { BillingSubscription, type BillingSubscriptionSnapshot } from '../../../domain/subscription.js';
import { BillingUsageRecord, type BillingUsageRecordSnapshot } from '../../../domain/usage-record.js';
import {
  jsonRecord,
  parseCheckoutStatus,
  parseInterval,
  parseInvoiceLineKind,
  parseInvoiceStatus,
  parseProviderName,
  parseSubscriptionStatus,
  parseUsageMetric,
} from '../../../domain/values.js';

export class PostgresBillingPlanRepository implements BillingPlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(plan: BillingPlan): Promise<void> {
    const snapshot = plan.toSnapshot();
    const data = toPlanRecord(snapshot);
    await this.prisma.billingPlan.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        interval: data.interval,
        currency: data.currency,
        amountCents: data.amountCents,
        trialDays: data.trialDays,
        quotas: data.quotas,
        features: data.features,
        public: data.public,
        active: data.active,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(planId: BillingPlanId): Promise<BillingPlan | null> {
    const record = await this.prisma.billingPlan.findUnique({ where: { id: planId } });
    return record ? toPlan(record) : null;
  }

  async findBySlug(slug: string): Promise<BillingPlan | null> {
    const record = await this.prisma.billingPlan.findUnique({ where: { slug } });
    return record ? toPlan(record) : null;
  }

  async listPublic(): Promise<BillingPlan[]> {
    const records = await this.prisma.billingPlan.findMany({
      where: { active: true, public: true },
      orderBy: { amountCents: 'asc' },
    });
    return records.map(toPlan);
  }

  async listAll(): Promise<BillingPlan[]> {
    const records = await this.prisma.billingPlan.findMany({ orderBy: { amountCents: 'asc' } });
    return records.map(toPlan);
  }
}

export class PostgresBillingSubscriptionRepository implements BillingSubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(subscription: BillingSubscription): Promise<void> {
    const snapshot = subscription.toSnapshot();
    const data = toSubscriptionRecord(snapshot);
    await this.prisma.billingSubscription.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        planId: data.planId,
        status: data.status,
        interval: data.interval,
        seats: data.seats,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialEndsAt: data.trialEndsAt,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        canceledAt: data.canceledAt,
        provider: data.provider,
        providerCustomerId: data.providerCustomerId,
        providerSubscriptionId: data.providerSubscriptionId,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findByTenant(tenantId: string): Promise<BillingSubscription | null> {
    const record = await this.prisma.billingSubscription.findUnique({
      where: { organizationId: tenantId },
    });
    return record ? toSubscription(record) : null;
  }

  async findById(
    tenantId: string,
    subscriptionId: BillingSubscriptionId,
  ): Promise<BillingSubscription | null> {
    const record = await this.prisma.billingSubscription.findFirst({
      where: { id: subscriptionId, organizationId: tenantId },
    });
    return record ? toSubscription(record) : null;
  }

  async findByProviderSubscriptionId(provider: string, providerSubscriptionId: string) {
    const record = await this.prisma.billingSubscription.findFirst({
      where: { provider, providerSubscriptionId },
    });
    return record ? toSubscription(record) : null;
  }

  async listDueForRenewal(now: Date, limit: number): Promise<BillingSubscription[]> {
    const records = await this.prisma.billingSubscription.findMany({
      where: {
        status: { in: ['trialing', 'active', 'past_due'] },
        currentPeriodEnd: { lte: now },
      },
      orderBy: { currentPeriodEnd: 'asc' },
      take: limit,
    });
    return records.map(toSubscription);
  }
}

export class PostgresBillingCheckoutSessionRepository implements BillingCheckoutSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(session: BillingCheckoutSession): Promise<void> {
    const snapshot = session.toSnapshot();
    const data = toCheckoutRecord(snapshot);
    await this.prisma.billingCheckoutSession.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        completedAt: data.completedAt,
      },
    });
  }

  async findById(tenantId: string, sessionId: BillingCheckoutSessionId) {
    const record = await this.prisma.billingCheckoutSession.findFirst({
      where: { id: sessionId, organizationId: tenantId },
    });
    return record ? toCheckout(record) : null;
  }

  async findByProviderSessionId(providerSessionId: string) {
    const record = await this.prisma.billingCheckoutSession.findUnique({
      where: { providerSessionId },
    });
    return record ? toCheckout(record) : null;
  }
}

export class PostgresBillingUsageRepository implements BillingUsageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(record: BillingUsageRecord): Promise<void> {
    await this.prisma.billingUsageRecord.create({ data: toUsageRecord(record.toSnapshot()) });
  }

  async tryInsert(record: BillingUsageRecord): Promise<boolean> {
    try {
      await this.save(record);
      return true;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async sumByPeriod(
    tenantId: string,
    subscriptionId: BillingSubscriptionId,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<UsageTotals> {
    const groups = await this.prisma.billingUsageRecord.groupBy({
      by: ['metric'],
      where: { organizationId: tenantId, subscriptionId, periodStart, periodEnd },
      _sum: { quantity: true },
    });
    const totals = emptyUsageTotals();
    for (const group of groups) {
      if ((BILLING_USAGE_METRICS as readonly string[]).includes(group.metric)) {
        totals[parseUsageMetric(group.metric)] = group._sum.quantity ?? 0;
      }
    }
    return totals;
  }
}

export class PostgresBillingInvoiceRepository implements BillingInvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(invoice: BillingInvoice): Promise<void> {
    const snapshot = invoice.toSnapshot();
    const header = toInvoiceRecord(snapshot);
    await this.prisma.$transaction([
      this.prisma.billingInvoice.upsert({
        where: { id: snapshot.id },
        create: header,
        update: {
          status: header.status,
          amountPaidCents: header.amountPaidCents,
          amountDueCents: header.amountDueCents,
          paidAt: header.paidAt,
          voidedAt: header.voidedAt,
          hostedUrl: header.hostedUrl,
          providerInvoiceId: header.providerInvoiceId,
          updatedAt: header.updatedAt,
        },
      }),
      this.prisma.billingInvoiceLine.deleteMany({ where: { invoiceId: snapshot.id } }),
      this.prisma.billingInvoiceLine.createMany({
        data: snapshot.lines.map((line) => ({
          id: line.id,
          organizationId: snapshot.organizationId,
          invoiceId: snapshot.id,
          description: line.description,
          kind: line.kind,
          metric: line.metric ?? null,
          quantity: line.quantity,
          unitAmountCents: line.unitAmountCents,
          amountCents: line.amountCents,
        })),
      }),
    ]);
  }

  async findById(tenantId: string, invoiceId: BillingInvoiceId) {
    const record = await this.prisma.billingInvoice.findFirst({
      where: { id: invoiceId, organizationId: tenantId },
      include: { lines: { orderBy: { description: 'asc' } } },
    });
    return record ? toInvoice(record) : null;
  }

  async findByPeriod(
    tenantId: string,
    subscriptionId: BillingSubscriptionId,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const record = await this.prisma.billingInvoice.findFirst({
      where: { organizationId: tenantId, subscriptionId, periodStart, periodEnd },
      include: { lines: true },
    });
    return record ? toInvoice(record) : null;
  }

  async findByProviderInvoiceId(providerInvoiceId: string) {
    const record = await this.prisma.billingInvoice.findFirst({
      where: { providerInvoiceId },
      include: { lines: true },
    });
    return record ? toInvoice(record) : null;
  }

  async listByTenant(tenantId: string, page: PageRequest, filter?: BillingInvoiceListFilter): Promise<Page<BillingInvoice>> {
    const where = {
      organizationId: tenantId,
      ...(filter?.status ? { status: filter.status } : {}),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.billingInvoice.count({ where }),
      this.prisma.billingInvoice.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
    ]);
    return {
      items: records.map(toInvoice),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class PostgresBillingPaymentMethodRepository implements BillingPaymentMethodRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(method: BillingPaymentMethod): Promise<void> {
    const snapshot = method.toSnapshot();
    const data = toPaymentMethodRecord(snapshot);
    await this.prisma.billingPaymentMethod.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        isDefault: data.isDefault,
        brand: data.brand,
        lastFour: data.lastFour,
        expMonth: data.expMonth,
        expYear: data.expYear,
      },
    });
  }

  async listByTenant(tenantId: string) {
    const records = await this.prisma.billingPaymentMethod.findMany({
      where: { organizationId: tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(toPaymentMethod);
  }

  async clearDefault(tenantId: string): Promise<void> {
    await this.prisma.billingPaymentMethod.updateMany({
      where: { organizationId: tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }
}

export class PostgresBillingProviderEventRepository implements BillingProviderEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(event: BillingProviderEvent): Promise<void> {
    const snapshot = event.toSnapshot();
    const data = toProviderEventRecord(snapshot);
    await this.prisma.billingProviderEvent.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        processedAt: data.processedAt,
        error: data.error,
      },
    });
  }

  async tryInsert(event: BillingProviderEvent): Promise<boolean> {
    try {
      await this.prisma.billingProviderEvent.create({ data: toProviderEventRecord(event.toSnapshot()) });
      return true;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async findByProviderEventId(providerEventId: string) {
    const record = await this.prisma.billingProviderEvent.findUnique({ where: { providerEventId } });
    return record ? toProviderEvent(record) : null;
  }
}

function toPlanRecord(snapshot: BillingPlanSnapshot): Prisma.BillingPlanUncheckedCreateInput {
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    name: snapshot.name,
    description: snapshot.description,
    interval: snapshot.interval,
    currency: snapshot.currency,
    amountCents: snapshot.amountCents,
    trialDays: snapshot.trialDays,
    quotas: snapshot.quotas as unknown as Prisma.InputJsonValue,
    features: [...snapshot.features],
    public: snapshot.public,
    active: snapshot.active,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toPlan(record: Prisma.BillingPlanGetPayload<object>): BillingPlan {
  return BillingPlan.reconstitute({
    id: createBillingPlanId(record.id),
    slug: record.slug,
    name: record.name,
    description: record.description,
    interval: parseInterval(record.interval),
    currency: record.currency,
    amountCents: record.amountCents,
    trialDays: record.trialDays,
    quotas: parsePlanQuotas(record.quotas),
    features: record.features,
    public: record.public,
    active: record.active,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toSubscriptionRecord(
  snapshot: BillingSubscriptionSnapshot,
): Prisma.BillingSubscriptionUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    planId: snapshot.planId,
    status: snapshot.status,
    interval: snapshot.interval,
    seats: snapshot.seats,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    trialEndsAt: snapshot.trialEndsAt ?? null,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.canceledAt ?? null,
    provider: snapshot.provider,
    providerCustomerId: snapshot.providerCustomerId ?? null,
    providerSubscriptionId: snapshot.providerSubscriptionId ?? null,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toSubscription(record: Prisma.BillingSubscriptionGetPayload<object>): BillingSubscription {
  return BillingSubscription.reconstitute({
    id: createBillingSubscriptionId(record.id),
    organizationId: record.organizationId,
    planId: createBillingPlanId(record.planId),
    status: parseSubscriptionStatus(record.status),
    interval: parseInterval(record.interval),
    seats: record.seats,
    currentPeriodStart: record.currentPeriodStart,
    currentPeriodEnd: record.currentPeriodEnd,
    trialEndsAt: record.trialEndsAt ?? undefined,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    canceledAt: record.canceledAt ?? undefined,
    provider: parseProviderName(record.provider),
    providerCustomerId: record.providerCustomerId ?? undefined,
    providerSubscriptionId: record.providerSubscriptionId ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toCheckoutRecord(
  snapshot: BillingCheckoutSessionSnapshot,
): Prisma.BillingCheckoutSessionUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subscriptionId: snapshot.subscriptionId ?? null,
    planId: snapshot.planId,
    status: snapshot.status,
    provider: snapshot.provider,
    providerSessionId: snapshot.providerSessionId,
    url: snapshot.url ?? null,
    successUrl: snapshot.successUrl,
    cancelUrl: snapshot.cancelUrl,
    createdByUserId: snapshot.createdByUserId,
    expiresAt: snapshot.expiresAt,
    completedAt: snapshot.completedAt ?? null,
    createdAt: snapshot.createdAt,
  };
}

function toCheckout(record: Prisma.BillingCheckoutSessionGetPayload<object>): BillingCheckoutSession {
  return BillingCheckoutSession.reconstitute({
    id: createBillingCheckoutSessionId(record.id),
    organizationId: record.organizationId,
    subscriptionId: record.subscriptionId
      ? createBillingSubscriptionId(record.subscriptionId)
      : undefined,
    planId: createBillingPlanId(record.planId),
    status: parseCheckoutStatus(record.status),
    provider: parseProviderName(record.provider),
    providerSessionId: record.providerSessionId,
    url: record.url ?? undefined,
    successUrl: record.successUrl,
    cancelUrl: record.cancelUrl,
    createdByUserId: record.createdByUserId,
    expiresAt: record.expiresAt,
    completedAt: record.completedAt ?? undefined,
    createdAt: record.createdAt,
  });
}

function toUsageRecord(snapshot: BillingUsageRecordSnapshot): Prisma.BillingUsageRecordUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subscriptionId: snapshot.subscriptionId,
    metric: snapshot.metric,
    quantity: snapshot.quantity,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    source: snapshot.source,
    sourceEventId: snapshot.sourceEventId ?? null,
    idempotencyKey: snapshot.idempotencyKey,
    createdAt: snapshot.createdAt,
  };
}

function toInvoiceRecord(snapshot: BillingInvoiceSnapshot): Prisma.BillingInvoiceUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    subscriptionId: snapshot.subscriptionId,
    number: snapshot.number,
    status: snapshot.status,
    currency: snapshot.currency,
    subtotalCents: snapshot.subtotalCents,
    taxCents: snapshot.taxCents,
    totalCents: snapshot.totalCents,
    amountPaidCents: snapshot.amountPaidCents,
    amountDueCents: snapshot.amountDueCents,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    dueAt: snapshot.dueAt,
    paidAt: snapshot.paidAt ?? null,
    voidedAt: snapshot.voidedAt ?? null,
    hostedUrl: snapshot.hostedUrl ?? null,
    provider: snapshot.provider,
    providerInvoiceId: snapshot.providerInvoiceId ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toInvoice(
  record: Prisma.BillingInvoiceGetPayload<{ include: { lines: true } }>,
): BillingInvoice {
  return BillingInvoice.reconstitute({
    id: createBillingInvoiceId(record.id),
    organizationId: record.organizationId,
    subscriptionId: createBillingSubscriptionId(record.subscriptionId),
    number: record.number,
    status: parseInvoiceStatus(record.status),
    currency: record.currency,
    subtotalCents: record.subtotalCents,
    taxCents: record.taxCents,
    totalCents: record.totalCents,
    amountPaidCents: record.amountPaidCents,
    amountDueCents: record.amountDueCents,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    dueAt: record.dueAt,
    paidAt: record.paidAt ?? undefined,
    voidedAt: record.voidedAt ?? undefined,
    hostedUrl: record.hostedUrl ?? undefined,
    provider: parseProviderName(record.provider),
    providerInvoiceId: record.providerInvoiceId ?? undefined,
    lines: record.lines.map((line) => ({
      id: createBillingInvoiceLineId(line.id),
      description: line.description,
      kind: parseInvoiceLineKind(line.kind),
      metric: line.metric ? parseUsageMetric(line.metric) : undefined,
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      amountCents: line.amountCents,
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toPaymentMethodRecord(
  snapshot: BillingPaymentMethodSnapshot,
): Prisma.BillingPaymentMethodUncheckedCreateInput {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    provider: snapshot.provider,
    providerPaymentMethodId: snapshot.providerPaymentMethodId ?? null,
    brand: snapshot.brand ?? null,
    lastFour: snapshot.lastFour ?? null,
    expMonth: snapshot.expMonth ?? null,
    expYear: snapshot.expYear ?? null,
    isDefault: snapshot.isDefault,
    createdAt: snapshot.createdAt,
  };
}

function toPaymentMethod(record: Prisma.BillingPaymentMethodGetPayload<object>): BillingPaymentMethod {
  return BillingPaymentMethod.reconstitute({
    id: createBillingPaymentMethodId(record.id),
    organizationId: record.organizationId,
    provider: parseProviderName(record.provider),
    providerPaymentMethodId: record.providerPaymentMethodId ?? undefined,
    brand: record.brand ?? undefined,
    lastFour: record.lastFour ?? undefined,
    expMonth: record.expMonth ?? undefined,
    expYear: record.expYear ?? undefined,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
  });
}

function toProviderEventRecord(
  snapshot: BillingProviderEventSnapshot,
): Prisma.BillingProviderEventUncheckedCreateInput {
  return {
    id: snapshot.id,
    provider: snapshot.provider,
    providerEventId: snapshot.providerEventId,
    type: snapshot.type,
    payload: snapshot.payload as Prisma.InputJsonValue,
    processedAt: snapshot.processedAt ?? null,
    error: snapshot.error ?? null,
    createdAt: snapshot.createdAt,
  };
}

function toProviderEvent(record: Prisma.BillingProviderEventGetPayload<object>): BillingProviderEvent {
  return BillingProviderEvent.reconstitute({
    id: createBillingProviderEventId(record.id),
    provider: parseProviderName(record.provider),
    providerEventId: record.providerEventId,
    type: record.type,
    payload: jsonRecord(record.payload),
    processedAt: record.processedAt ?? undefined,
    error: record.error ?? undefined,
    createdAt: record.createdAt,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
