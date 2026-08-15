import type { BillingInterval, BillingProviderName, BillingSubscriptionStatus } from '@ai-customer-support/contracts';
import { CONSUMING_SUBSCRIPTION_STATUSES } from './billing-policy.js';
import { InvalidBillingError, InvalidBillingStateError } from './errors.js';
import { createBillingSubscriptionId, type BillingPlanId, type BillingSubscriptionId } from './ids.js';
import {
  addUtcInterval,
  parseInterval,
  parseProviderName,
  requirePositiveInt,
} from './values.js';

export type BillingSubscriptionSnapshot = {
  readonly id: BillingSubscriptionId;
  readonly organizationId: string;
  readonly planId: BillingPlanId;
  readonly status: BillingSubscriptionStatus;
  readonly interval: BillingInterval;
  readonly seats: number;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly trialEndsAt?: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt?: Date;
  readonly provider: BillingProviderName;
  readonly providerCustomerId?: string;
  readonly providerSubscriptionId?: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class BillingSubscription {
  private constructor(
    readonly id: BillingSubscriptionId,
    readonly organizationId: string,
    private planIdValue: BillingPlanId,
    private statusValue: BillingSubscriptionStatus,
    private intervalValue: BillingInterval,
    private seatsValue: number,
    private currentPeriodStartValue: Date,
    private currentPeriodEndValue: Date,
    private trialEndsAtValue: Date | undefined,
    private cancelAtPeriodEndValue: boolean,
    private canceledAtValue: Date | undefined,
    private providerValue: BillingProviderName,
    private providerCustomerIdValue: string | undefined,
    private providerSubscriptionIdValue: string | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    private updatedAtValue: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly planId: BillingPlanId;
    readonly interval: string;
    readonly seats: number;
    readonly now: Date;
    readonly createdByUserId: string;
    readonly provider: string;
    readonly trialDays?: number;
    readonly paid?: boolean;
    readonly providerCustomerId?: string;
    readonly providerSubscriptionId?: string;
    readonly id?: BillingSubscriptionId;
  }): BillingSubscription {
    if (!input.organizationId.trim()) {
      throw new InvalidBillingError('Organization is required');
    }
    const interval = parseInterval(input.interval);
    const periodEnd = addUtcInterval(input.now, interval);
    const trialDays = input.trialDays ?? 0;
    const trialEndsAt = trialDays > 0 ? new Date(input.now.getTime() + trialDays * 86_400_000) : undefined;
    const status: BillingSubscriptionStatus =
      trialEndsAt && !input.paid ? 'trialing' : input.paid === false ? 'incomplete' : 'active';
    return new BillingSubscription(
      input.id ?? createBillingSubscriptionId(),
      input.organizationId,
      input.planId,
      status,
      interval,
      requirePositiveInt(input.seats, 'seats', 10_000) || 1,
      input.now,
      periodEnd,
      trialEndsAt,
      false,
      undefined,
      parseProviderName(input.provider),
      input.providerCustomerId,
      input.providerSubscriptionId,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingSubscriptionSnapshot): BillingSubscription {
    return new BillingSubscription(
      snapshot.id,
      snapshot.organizationId,
      snapshot.planId,
      snapshot.status,
      snapshot.interval,
      snapshot.seats,
      snapshot.currentPeriodStart,
      snapshot.currentPeriodEnd,
      snapshot.trialEndsAt,
      snapshot.cancelAtPeriodEnd,
      snapshot.canceledAt,
      snapshot.provider,
      snapshot.providerCustomerId,
      snapshot.providerSubscriptionId,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get planId(): BillingPlanId {
    return this.planIdValue;
  }

  get status(): BillingSubscriptionStatus {
    return this.statusValue;
  }

  get interval(): BillingInterval {
    return this.intervalValue;
  }

  get seats(): number {
    return this.seatsValue;
  }

  get currentPeriodStart(): Date {
    return this.currentPeriodStartValue;
  }

  get currentPeriodEnd(): Date {
    return this.currentPeriodEndValue;
  }

  get trialEndsAt(): Date | undefined {
    return this.trialEndsAtValue;
  }

  get cancelAtPeriodEnd(): boolean {
    return this.cancelAtPeriodEndValue;
  }

  get canceledAt(): Date | undefined {
    return this.canceledAtValue;
  }

  get provider(): BillingProviderName {
    return this.providerValue;
  }

  get providerCustomerId(): string | undefined {
    return this.providerCustomerIdValue;
  }

  get providerSubscriptionId(): string | undefined {
    return this.providerSubscriptionIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  get allowsUsage(): boolean {
    return CONSUMING_SUBSCRIPTION_STATUSES.has(this.statusValue);
  }

  periodContains(at: Date): boolean {
    return at >= this.currentPeriodStartValue && at < this.currentPeriodEndValue;
  }

  activate(now: Date, provider?: { customerId?: string; subscriptionId?: string }): void {
    if (this.statusValue === 'canceled') {
      throw new InvalidBillingStateError('A canceled subscription cannot be reactivated; start a new checkout');
    }
    this.statusValue = 'active';
    this.cancelAtPeriodEndValue = false;
    this.canceledAtValue = undefined;
    if (provider?.customerId) {
      this.providerCustomerIdValue = provider.customerId;
    }
    if (provider?.subscriptionId) {
      this.providerSubscriptionIdValue = provider.subscriptionId;
    }
    this.updatedAtValue = now;
  }

  markPastDue(now: Date): void {
    if (!this.allowsUsage && this.statusValue !== 'incomplete') {
      throw new InvalidBillingStateError('Only an active subscription can become past due');
    }
    this.statusValue = 'past_due';
    this.updatedAtValue = now;
  }

  markUnpaid(now: Date): void {
    this.statusValue = 'unpaid';
    this.updatedAtValue = now;
  }

  changePlan(planId: BillingPlanId, interval: BillingInterval, now: Date): void {
    if (!this.allowsUsage) {
      throw new InvalidBillingStateError('Plan changes require an active or trialing subscription');
    }
    this.planIdValue = planId;
    this.intervalValue = interval;
    this.updatedAtValue = now;
  }

  attachProvider(input: {
    readonly provider: BillingProviderName;
    readonly customerId?: string;
    readonly subscriptionId?: string;
    readonly now: Date;
  }): void {
    this.providerValue = input.provider;
    this.providerCustomerIdValue = input.customerId ?? this.providerCustomerIdValue;
    this.providerSubscriptionIdValue = input.subscriptionId ?? this.providerSubscriptionIdValue;
    this.updatedAtValue = input.now;
  }

  scheduleCancel(now: Date): void {
    if (!this.allowsUsage) {
      throw new InvalidBillingStateError('Only an active subscription can be canceled at period end');
    }
    this.cancelAtPeriodEndValue = true;
    this.updatedAtValue = now;
  }

  cancelImmediately(now: Date): void {
    if (this.statusValue === 'canceled') {
      throw new InvalidBillingStateError('Subscription is already canceled');
    }
    this.statusValue = 'canceled';
    this.cancelAtPeriodEndValue = false;
    this.canceledAtValue = now;
    this.updatedAtValue = now;
  }

  resume(now: Date): void {
    if (this.statusValue === 'canceled') {
      throw new InvalidBillingStateError('A fully canceled subscription cannot be resumed');
    }
    if (!this.cancelAtPeriodEndValue) {
      throw new InvalidBillingStateError('Subscription is not scheduled for cancellation');
    }
    this.cancelAtPeriodEndValue = false;
    this.updatedAtValue = now;
  }

  renewPeriod(now: Date): { readonly previousStart: Date; readonly previousEnd: Date } {
    if (this.statusValue === 'canceled') {
      throw new InvalidBillingStateError('A canceled subscription cannot renew');
    }
    if (this.cancelAtPeriodEndValue) {
      this.cancelImmediately(now);
      return {
        previousStart: this.currentPeriodStartValue,
        previousEnd: this.currentPeriodEndValue,
      };
    }
    const previousStart = this.currentPeriodStartValue;
    const previousEnd = this.currentPeriodEndValue;
    this.currentPeriodStartValue = previousEnd;
    this.currentPeriodEndValue = addUtcInterval(previousEnd, this.intervalValue);
    if (this.trialEndsAtValue && this.trialEndsAtValue <= now) {
      this.statusValue = 'active';
      this.trialEndsAtValue = undefined;
    }
    this.updatedAtValue = now;
    return { previousStart, previousEnd };
  }

  applyProviderStatus(status: BillingSubscriptionStatus, now: Date): void {
    this.statusValue = status;
    if (status === 'canceled') {
      this.canceledAtValue = now;
      this.cancelAtPeriodEndValue = false;
    }
    this.updatedAtValue = now;
  }

  toSnapshot(): BillingSubscriptionSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      planId: this.planIdValue,
      status: this.statusValue,
      interval: this.intervalValue,
      seats: this.seatsValue,
      currentPeriodStart: this.currentPeriodStartValue,
      currentPeriodEnd: this.currentPeriodEndValue,
      trialEndsAt: this.trialEndsAtValue,
      cancelAtPeriodEnd: this.cancelAtPeriodEndValue,
      canceledAt: this.canceledAtValue,
      provider: this.providerValue,
      providerCustomerId: this.providerCustomerIdValue,
      providerSubscriptionId: this.providerSubscriptionIdValue,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
    };
  }
}
