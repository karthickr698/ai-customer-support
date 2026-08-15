import type {
  BillingInvoiceLineKind,
  BillingInvoiceStatus,
  BillingProviderName,
  BillingUsageMetric,
} from '@ai-customer-support/contracts';
import { INVOICE_DUE_DAYS } from './billing-policy.js';
import { InvalidBillingError, InvalidBillingStateError } from './errors.js';
import {
  createBillingInvoiceId,
  createBillingInvoiceLineId,
  type BillingInvoiceId,
  type BillingInvoiceLineId,
  type BillingSubscriptionId,
} from './ids.js';
import {
  invoiceNumber,
  normalizeCurrency,
  parseInvoiceLineKind,
  parseInvoiceStatus,
  parseProviderName,
  parseUsageMetric,
  requirePositiveInt,
} from './values.js';

export type InvoiceLineInput = {
  readonly description: string;
  readonly kind: string;
  readonly quantity: number;
  readonly unitAmountCents: number;
  readonly metric?: string;
  readonly id?: BillingInvoiceLineId;
};

export type BillingInvoiceLineSnapshot = {
  readonly id: BillingInvoiceLineId;
  readonly description: string;
  readonly kind: BillingInvoiceLineKind;
  readonly metric?: BillingUsageMetric;
  readonly quantity: number;
  readonly unitAmountCents: number;
  readonly amountCents: number;
};

export type BillingInvoiceSnapshot = {
  readonly id: BillingInvoiceId;
  readonly organizationId: string;
  readonly subscriptionId: BillingSubscriptionId;
  readonly number: string;
  readonly status: BillingInvoiceStatus;
  readonly currency: string;
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly amountPaidCents: number;
  readonly amountDueCents: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly dueAt: Date;
  readonly paidAt?: Date;
  readonly voidedAt?: Date;
  readonly hostedUrl?: string;
  readonly provider: BillingProviderName;
  readonly providerInvoiceId?: string;
  readonly lines: readonly BillingInvoiceLineSnapshot[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class BillingInvoice {
  private constructor(
    readonly id: BillingInvoiceId,
    readonly organizationId: string,
    readonly subscriptionId: BillingSubscriptionId,
    readonly number: string,
    private statusValue: BillingInvoiceStatus,
    readonly currency: string,
    readonly subtotalCents: number,
    readonly taxCents: number,
    readonly totalCents: number,
    private amountPaidCentsValue: number,
    private amountDueCentsValue: number,
    readonly periodStart: Date,
    readonly periodEnd: Date,
    readonly dueAt: Date,
    private paidAtValue: Date | undefined,
    private voidedAtValue: Date | undefined,
    private hostedUrlValue: string | undefined,
    readonly provider: BillingProviderName,
    private providerInvoiceIdValue: string | undefined,
    readonly lines: readonly BillingInvoiceLineSnapshot[],
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly subscriptionId: BillingSubscriptionId;
    readonly currency: string;
    readonly periodStart: Date;
    readonly periodEnd: Date;
    readonly now: Date;
    readonly provider: string;
    readonly lines: readonly InvoiceLineInput[];
    readonly taxCents?: number;
    readonly hostedUrl?: string;
    readonly providerInvoiceId?: string;
    readonly id?: BillingInvoiceId;
  }): BillingInvoice {
    if (!input.organizationId.trim()) {
      throw new InvalidBillingError('Organization is required');
    }
    if (input.lines.length === 0) {
      throw new InvalidBillingError('An invoice requires at least one line');
    }
    const lines = input.lines.map(toLineSnapshot);
    const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    const taxCents = requirePositiveInt(input.taxCents ?? 0, 'taxCents');
    const totalCents = subtotalCents + taxCents;
    const id = input.id ?? createBillingInvoiceId();
    const dueAt = new Date(input.now.getTime() + INVOICE_DUE_DAYS * 86_400_000);
    const status: BillingInvoiceStatus = totalCents === 0 ? 'paid' : 'open';
    return new BillingInvoice(
      id,
      input.organizationId,
      input.subscriptionId,
      invoiceNumber(input.periodStart, id),
      status,
      normalizeCurrency(input.currency),
      subtotalCents,
      taxCents,
      totalCents,
      status === 'paid' ? totalCents : 0,
      status === 'paid' ? 0 : totalCents,
      input.periodStart,
      input.periodEnd,
      dueAt,
      status === 'paid' ? input.now : undefined,
      undefined,
      input.hostedUrl,
      parseProviderName(input.provider),
      input.providerInvoiceId,
      lines,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingInvoiceSnapshot): BillingInvoice {
    return new BillingInvoice(
      snapshot.id,
      snapshot.organizationId,
      snapshot.subscriptionId,
      snapshot.number,
      snapshot.status,
      snapshot.currency,
      snapshot.subtotalCents,
      snapshot.taxCents,
      snapshot.totalCents,
      snapshot.amountPaidCents,
      snapshot.amountDueCents,
      snapshot.periodStart,
      snapshot.periodEnd,
      snapshot.dueAt,
      snapshot.paidAt,
      snapshot.voidedAt,
      snapshot.hostedUrl,
      snapshot.provider,
      snapshot.providerInvoiceId,
      snapshot.lines,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): BillingInvoiceStatus {
    return this.statusValue;
  }

  get amountPaidCents(): number {
    return this.amountPaidCentsValue;
  }

  get amountDueCents(): number {
    return this.amountDueCentsValue;
  }

  get paidAt(): Date | undefined {
    return this.paidAtValue;
  }

  get voidedAt(): Date | undefined {
    return this.voidedAtValue;
  }

  get hostedUrl(): string | undefined {
    return this.hostedUrlValue;
  }

  get providerInvoiceId(): string | undefined {
    return this.providerInvoiceIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  attachProvider(providerInvoiceId: string, hostedUrl: string | undefined, now: Date): void {
    this.providerInvoiceIdValue = providerInvoiceId;
    this.hostedUrlValue = hostedUrl ?? this.hostedUrlValue;
    this.updatedAtValue = now;
  }

  markPaid(now: Date): void {
    if (this.statusValue === 'paid') {
      return;
    }
    if (this.statusValue !== 'open') {
      throw new InvalidBillingStateError('Only an open invoice can be paid');
    }
    this.statusValue = 'paid';
    this.amountPaidCentsValue = this.totalCents;
    this.amountDueCentsValue = 0;
    this.paidAtValue = now;
    this.updatedAtValue = now;
  }

  markUncollectible(now: Date): void {
    if (this.statusValue !== 'open') {
      throw new InvalidBillingStateError('Only an open invoice can be marked uncollectible');
    }
    this.statusValue = 'uncollectible';
    this.updatedAtValue = now;
  }

  void(now: Date): void {
    if (this.statusValue === 'paid') {
      throw new InvalidBillingStateError('A paid invoice cannot be voided');
    }
    if (this.statusValue === 'void') {
      return;
    }
    this.statusValue = 'void';
    this.voidedAtValue = now;
    this.amountDueCentsValue = 0;
    this.updatedAtValue = now;
  }

  toSnapshot(): BillingInvoiceSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      subscriptionId: this.subscriptionId,
      number: this.number,
      status: this.statusValue,
      currency: this.currency,
      subtotalCents: this.subtotalCents,
      taxCents: this.taxCents,
      totalCents: this.totalCents,
      amountPaidCents: this.amountPaidCentsValue,
      amountDueCents: this.amountDueCentsValue,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      dueAt: this.dueAt,
      paidAt: this.paidAtValue,
      voidedAt: this.voidedAtValue,
      hostedUrl: this.hostedUrlValue,
      provider: this.provider,
      providerInvoiceId: this.providerInvoiceIdValue,
      lines: this.lines,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}

function toLineSnapshot(input: InvoiceLineInput): BillingInvoiceLineSnapshot {
  const kind = parseInvoiceLineKind(input.kind);
  const quantity = requirePositiveInt(input.quantity, 'quantity', 1_000_000) || 1;
  const unitAmountCents = input.unitAmountCents;
  if (!Number.isInteger(unitAmountCents) || unitAmountCents < -10_000_000 || unitAmountCents > 10_000_000) {
    throw new InvalidBillingError('unitAmountCents is out of range');
  }
  const description = input.description.trim();
  if (description.length < 1 || description.length > 200) {
    throw new InvalidBillingError('Line description must be between 1 and 200 characters');
  }
  return {
    id: input.id ?? createBillingInvoiceLineId(),
    description,
    kind,
    metric: input.metric ? parseUsageMetric(input.metric) : undefined,
    quantity: Math.max(1, quantity),
    unitAmountCents,
    amountCents: unitAmountCents * Math.max(1, quantity),
  };
}

export function parseInvoiceStatusValue(value: string): BillingInvoiceStatus {
  return parseInvoiceStatus(value);
}
