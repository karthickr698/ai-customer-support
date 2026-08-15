import type { BillingProviderName } from '@ai-customer-support/contracts';
import { InvalidBillingError } from './errors.js';
import { createBillingPaymentMethodId, type BillingPaymentMethodId } from './ids.js';
import { parseProviderName } from './values.js';

export type BillingPaymentMethodSnapshot = {
  readonly id: BillingPaymentMethodId;
  readonly organizationId: string;
  readonly provider: BillingProviderName;
  readonly providerPaymentMethodId?: string;
  readonly brand?: string;
  readonly lastFour?: string;
  readonly expMonth?: number;
  readonly expYear?: number;
  readonly isDefault: boolean;
  readonly createdAt: Date;
};

export class BillingPaymentMethod {
  private constructor(
    readonly id: BillingPaymentMethodId,
    readonly organizationId: string,
    readonly provider: BillingProviderName,
    readonly providerPaymentMethodId: string | undefined,
    readonly brand: string | undefined,
    readonly lastFour: string | undefined,
    readonly expMonth: number | undefined,
    readonly expYear: number | undefined,
    private isDefaultValue: boolean,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly provider: string;
    readonly now: Date;
    readonly providerPaymentMethodId?: string;
    readonly brand?: string;
    readonly lastFour?: string;
    readonly expMonth?: number;
    readonly expYear?: number;
    readonly isDefault?: boolean;
    readonly id?: BillingPaymentMethodId;
  }): BillingPaymentMethod {
    if (!input.organizationId.trim()) {
      throw new InvalidBillingError('Organization is required');
    }
    return new BillingPaymentMethod(
      input.id ?? createBillingPaymentMethodId(),
      input.organizationId,
      parseProviderName(input.provider),
      input.providerPaymentMethodId,
      input.brand?.trim().slice(0, 40),
      input.lastFour?.replace(/\D/g, '').slice(-4),
      input.expMonth,
      input.expYear,
      input.isDefault ?? true,
      input.now,
    );
  }

  static reconstitute(snapshot: BillingPaymentMethodSnapshot): BillingPaymentMethod {
    return new BillingPaymentMethod(
      snapshot.id,
      snapshot.organizationId,
      snapshot.provider,
      snapshot.providerPaymentMethodId,
      snapshot.brand,
      snapshot.lastFour,
      snapshot.expMonth,
      snapshot.expYear,
      snapshot.isDefault,
      snapshot.createdAt,
    );
  }

  get isDefault(): boolean {
    return this.isDefaultValue;
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  markDefault(): void {
    this.isDefaultValue = true;
  }

  clearDefault(): void {
    this.isDefaultValue = false;
  }

  toSnapshot(): BillingPaymentMethodSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      provider: this.provider,
      providerPaymentMethodId: this.providerPaymentMethodId,
      brand: this.brand,
      lastFour: this.lastFour,
      expMonth: this.expMonth,
      expYear: this.expYear,
      isDefault: this.isDefaultValue,
      createdAt: this.createdAt,
    };
  }
}
