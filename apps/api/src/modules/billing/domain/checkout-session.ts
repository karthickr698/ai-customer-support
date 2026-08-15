import type {
  BillingCheckoutStatus,
  BillingProviderName,
} from '@ai-customer-support/contracts';
import { CHECKOUT_TTL_MS } from './billing-policy.js';
import { InvalidBillingError, InvalidBillingStateError } from './errors.js';
import {
  createBillingCheckoutSessionId,
  type BillingCheckoutSessionId,
  type BillingPlanId,
  type BillingSubscriptionId,
} from './ids.js';
import { parseProviderName } from './values.js';

export type BillingCheckoutSessionSnapshot = {
  readonly id: BillingCheckoutSessionId;
  readonly organizationId: string;
  readonly subscriptionId?: BillingSubscriptionId;
  readonly planId: BillingPlanId;
  readonly status: BillingCheckoutStatus;
  readonly provider: BillingProviderName;
  readonly providerSessionId: string;
  readonly url?: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly createdByUserId: string;
  readonly expiresAt: Date;
  readonly completedAt?: Date;
  readonly createdAt: Date;
};

export class BillingCheckoutSession {
  private constructor(
    readonly id: BillingCheckoutSessionId,
    readonly organizationId: string,
    readonly subscriptionId: BillingSubscriptionId | undefined,
    readonly planId: BillingPlanId,
    private statusValue: BillingCheckoutStatus,
    readonly provider: BillingProviderName,
    readonly providerSessionId: string,
    readonly url: string | undefined,
    readonly successUrl: string,
    readonly cancelUrl: string,
    readonly createdByUserId: string,
    readonly expiresAt: Date,
    private completedAtValue: Date | undefined,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly planId: BillingPlanId;
    readonly provider: string;
    readonly providerSessionId: string;
    readonly successUrl: string;
    readonly cancelUrl: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly subscriptionId?: BillingSubscriptionId;
    readonly url?: string;
    readonly id?: BillingCheckoutSessionId;
  }): BillingCheckoutSession {
    if (!input.organizationId.trim()) {
      throw new InvalidBillingError('Organization is required');
    }
    const sessionId = input.providerSessionId.trim();
    if (sessionId.length < 1 || sessionId.length > 200) {
      throw new InvalidBillingError('Provider checkout session id is required');
    }
    return new BillingCheckoutSession(
      input.id ?? createBillingCheckoutSessionId(),
      input.organizationId,
      input.subscriptionId,
      input.planId,
      'pending',
      parseProviderName(input.provider),
      sessionId,
      input.url,
      input.successUrl,
      input.cancelUrl,
      input.createdByUserId,
      new Date(input.now.getTime() + CHECKOUT_TTL_MS),
      undefined,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingCheckoutSessionSnapshot): BillingCheckoutSession {
    return new BillingCheckoutSession(
      snapshot.id,
      snapshot.organizationId,
      snapshot.subscriptionId,
      snapshot.planId,
      snapshot.status,
      snapshot.provider,
      snapshot.providerSessionId,
      snapshot.url,
      snapshot.successUrl,
      snapshot.cancelUrl,
      snapshot.createdByUserId,
      snapshot.expiresAt,
      snapshot.completedAt,
      snapshot.createdAt,
    );
  }

  get status(): BillingCheckoutStatus {
    return this.statusValue;
  }

  get completedAt(): Date | undefined {
    return this.completedAtValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  isOpen(now: Date): boolean {
    return this.statusValue === 'pending' && this.expiresAt > now;
  }

  complete(now: Date): void {
    if (this.statusValue === 'completed') {
      return;
    }
    if (this.statusValue !== 'pending') {
      throw new InvalidBillingStateError('Checkout session is no longer pending');
    }
    if (this.expiresAt <= now) {
      this.statusValue = 'expired';
      throw new InvalidBillingStateError('Checkout session has expired');
    }
    this.statusValue = 'completed';
    this.completedAtValue = now;
  }

  expire(now: Date): void {
    if (this.statusValue !== 'pending') {
      return;
    }
    if (this.expiresAt > now) {
      return;
    }
    this.statusValue = 'expired';
  }

  toSnapshot(): BillingCheckoutSessionSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      subscriptionId: this.subscriptionId,
      planId: this.planId,
      status: this.statusValue,
      provider: this.provider,
      providerSessionId: this.providerSessionId,
      url: this.url,
      successUrl: this.successUrl,
      cancelUrl: this.cancelUrl,
      createdByUserId: this.createdByUserId,
      expiresAt: this.expiresAt,
      completedAt: this.completedAtValue,
      createdAt: this.createdAt,
    };
  }
}
