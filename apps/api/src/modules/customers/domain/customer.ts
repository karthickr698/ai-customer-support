import type { CustomerStatus } from '@ai-customer-support/contracts';
import { InvalidCustomerRecordError } from './errors.js';
import { createCustomerId, type CustomerId } from './ids.js';
import {
  normalizeEmail,
  normalizeName,
  normalizeOptionalExternalId,
  normalizeOptionalPhone,
  parseCustomerStatus,
} from './values.js';

export type CustomerSnapshot = {
  readonly id: CustomerId;
  readonly organizationId: string;
  readonly email: string;
  readonly name: string;
  readonly phone?: string;
  readonly status: CustomerStatus;
  readonly externalCustomerId?: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Customer {
  private constructor(
    readonly id: CustomerId,
    readonly organizationId: string,
    readonly email: string,
    readonly name: string,
    readonly phone: string | undefined,
    readonly status: CustomerStatus,
    readonly externalCustomerId: string | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly email: string;
    readonly name: string;
    readonly phone?: string;
    readonly status?: string;
    readonly externalCustomerId?: string;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: CustomerId;
  }): Customer {
    if (!input.organizationId.trim()) {
      throw new InvalidCustomerRecordError('Organization is required');
    }
    return new Customer(
      input.id ?? createCustomerId(),
      input.organizationId,
      normalizeEmail(input.email),
      normalizeName(input.name, 'Customer name'),
      normalizeOptionalPhone(input.phone),
      parseCustomerStatus(input.status),
      normalizeOptionalExternalId(input.externalCustomerId, 'External customer id'),
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: CustomerSnapshot): Customer {
    return new Customer(
      snapshot.id,
      snapshot.organizationId,
      snapshot.email,
      snapshot.name,
      snapshot.phone,
      snapshot.status,
      snapshot.externalCustomerId,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): CustomerSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      email: this.email,
      name: this.name,
      phone: this.phone,
      status: this.status,
      externalCustomerId: this.externalCustomerId,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
