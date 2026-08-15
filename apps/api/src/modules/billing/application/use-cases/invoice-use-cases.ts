import type { EventBus } from '@ai-customer-support/shared';
import type {
  BillingInvoiceListResponse,
  BillingInvoiceResponse,
  BillingPaymentMethodListResponse,
} from '@ai-customer-support/contracts';
import { BILLING_USAGE_METRICS } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { BillingPolicy } from '../../domain/billing-policy.js';
import {
  BillingInvoiceNotFoundError,
  DuplicateBillingInvoiceError,
  InvalidBillingError,
} from '../../domain/errors.js';
import { InvoiceFinalizedEvent, InvoicePaidEvent } from '../../domain/events.js';
import { createBillingInvoiceId } from '../../domain/ids.js';
import { BillingInvoice, type InvoiceLineInput } from '../../domain/invoice.js';
import { isUuid, parseInvoiceStatus } from '../../domain/values.js';
import type { RequestSecurityContext } from '../dtos.js';
import { emptyUsageTotals, toInvoiceDto, toPaymentMethodDto, usedFor } from '../dtos.js';
import type {
  BillingInvoiceRepository,
  BillingPaymentMethodRepository,
  BillingPlanRepository,
  BillingSubscriptionRepository,
  BillingUsageRepository,
  ClockPort,
  TenantAccessPort,
} from '../ports.js';
import { loadSubscription } from './subscription-query-use-cases.js';

export class ListBillingInvoicesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly invoices: BillingInvoiceRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: { readonly page: number; readonly pageSize: number };
    readonly status?: string;
  }): Promise<BillingInvoiceListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_READ);
    const result = await this.invoices.listByTenant(actor.tenantId, input.page, {
      status: input.status ? parseInvoiceStatus(input.status) : undefined,
    });
    return {
      items: result.items.filter((invoice) => invoice.belongsTo(actor.tenantId)).map(toInvoiceDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export class GetBillingInvoiceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly invoices: BillingInvoiceRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly invoiceId: string;
  }): Promise<BillingInvoiceResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_READ);
    const invoice = await loadInvoice(this.invoices, actor.tenantId, input.invoiceId);
    return { invoice: toInvoiceDto(invoice) };
  }
}

export class IssueBillingInvoiceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly usage: BillingUsageRepository,
    private readonly invoices: BillingInvoiceRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly periodStart?: string;
    readonly periodEnd?: string;
    readonly security: RequestSecurityContext;
  }): Promise<BillingInvoiceResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const { subscription, plan } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    const periodStart = input.periodStart ? new Date(input.periodStart) : subscription.currentPeriodStart;
    const periodEnd = input.periodEnd ? new Date(input.periodEnd) : subscription.currentPeriodEnd;
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) {
      throw new InvalidBillingError('Invoice period is invalid');
    }
    const invoice = await issueInvoiceForPeriod({
      invoices: this.invoices,
      usage: this.usage,
      clock: this.clock,
      eventBus: this.eventBus,
      tenantId: actor.tenantId,
      subscription,
      planName: plan.name,
      amountCents: plan.amountCents,
      currency: plan.currency,
      quotas: plan.quotas,
      provider: subscription.provider,
      periodStart,
      periodEnd,
      correlationId: input.security.correlationId,
    });
    return { invoice: toInvoiceDto(invoice) };
  }
}

export class PayBillingInvoiceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly invoices: BillingInvoiceRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly plans: BillingPlanRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly invoiceId: string;
    readonly security: RequestSecurityContext;
  }): Promise<BillingInvoiceResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const invoice = await loadInvoice(this.invoices, actor.tenantId, input.invoiceId);
    const now = this.clock.now();
    invoice.markPaid(now);
    await this.invoices.save(invoice);
    const { subscription } = await loadSubscription(this.subscriptions, this.plans, actor.tenantId);
    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      subscription.activate(now);
      await this.subscriptions.save(subscription);
    }
    await this.eventBus.publish(
      new InvoicePaidEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        invoice.id,
        invoice.number,
        invoice.totalCents,
        input.security.correlationId,
      ),
    );
    return { invoice: toInvoiceDto(invoice) };
  }
}

export class VoidBillingInvoiceUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly invoices: BillingInvoiceRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly invoiceId: string;
  }): Promise<BillingInvoiceResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_MANAGE);
    const invoice = await loadInvoice(this.invoices, actor.tenantId, input.invoiceId);
    invoice.void(this.clock.now());
    await this.invoices.save(invoice);
    return { invoice: toInvoiceDto(invoice) };
  }
}

export class ListBillingPaymentMethodsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly paymentMethods: BillingPaymentMethodRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<BillingPaymentMethodListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    BillingPolicy.assertPermission(actor.permissions, Permissions.BILLING_READ);
    const items = await this.paymentMethods.listByTenant(actor.tenantId);
    return { items: items.filter((method) => method.belongsTo(actor.tenantId)).map(toPaymentMethodDto) };
  }
}

export async function issueInvoiceForPeriod(input: {
  readonly invoices: BillingInvoiceRepository;
  readonly usage: BillingUsageRepository;
  readonly clock: ClockPort;
  readonly eventBus: EventBus;
  readonly tenantId: string;
  readonly subscription: import('../../domain/subscription.js').BillingSubscription;
  readonly planName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly quotas: import('../../domain/catalog.js').PlanQuotas;
  readonly provider: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly correlationId?: string;
}): Promise<BillingInvoice> {
  const existing = await input.invoices.findByPeriod(
    input.tenantId,
    input.subscription.id,
    input.periodStart,
    input.periodEnd,
  );
  if (existing) {
    throw new DuplicateBillingInvoiceError();
  }
  const totals =
    (await input.usage.sumByPeriod(
      input.tenantId,
      input.subscription.id,
      input.periodStart,
      input.periodEnd,
    )) ?? emptyUsageTotals();
  const lines: InvoiceLineInput[] = [
    {
      description: `${input.planName} subscription`,
      kind: 'plan',
      quantity: 1,
      unitAmountCents: input.amountCents,
    },
  ];
  for (const metric of BILLING_USAGE_METRICS) {
    const quota = input.quotas[metric];
    if (quota.included === null || quota.overageCents <= 0) {
      continue;
    }
    const used = usedFor(totals, metric);
    const overage = Math.max(0, used - quota.included);
    if (overage <= 0) {
      continue;
    }
    lines.push({
      description: `${metric.replaceAll('_', ' ')} overage`,
      kind: 'usage',
      metric,
      quantity: overage,
      unitAmountCents: quota.overageCents,
    });
  }
  const now = input.clock.now();
  const invoice = BillingInvoice.create({
    organizationId: input.tenantId,
    subscriptionId: input.subscription.id,
    currency: input.currency,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    now,
    provider: input.provider,
    lines,
  });
  await input.invoices.save(invoice);
  await input.eventBus.publish(
    new InvoiceFinalizedEvent(
      crypto.randomUUID(),
      now,
      input.tenantId,
      invoice.id,
      invoice.number,
      invoice.totalCents,
      input.correlationId,
    ),
  );
  if (invoice.status === 'paid') {
    await input.eventBus.publish(
      new InvoicePaidEvent(
        crypto.randomUUID(),
        now,
        input.tenantId,
        invoice.id,
        invoice.number,
        invoice.totalCents,
        input.correlationId,
      ),
    );
  }
  return invoice;
}

async function loadInvoice(
  invoices: BillingInvoiceRepository,
  tenantId: string,
  invoiceId: string,
): Promise<BillingInvoice> {
  if (!isUuid(invoiceId)) {
    throw new InvalidBillingError('invoiceId must be a UUID');
  }
  const invoice = await invoices.findById(tenantId, createBillingInvoiceId(invoiceId));
  if (!invoice || !invoice.belongsTo(tenantId)) {
    throw new BillingInvoiceNotFoundError();
  }
  return invoice;
}
