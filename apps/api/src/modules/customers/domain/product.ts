import type { ProductStatus } from '@ai-customer-support/contracts';
import { InvalidProductError } from './errors.js';
import { createProductId, type ProductId } from './ids.js';
import {
  normalizeCurrency,
  normalizeMoney,
  normalizeName,
  normalizeSku,
  parseProductStatus,
} from './values.js';

export type ProductSnapshot = {
  readonly id: ProductId;
  readonly organizationId: string;
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly status: ProductStatus;
  readonly currency: string;
  readonly priceAmount: number;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Product {
  private constructor(
    readonly id: ProductId,
    readonly organizationId: string,
    readonly sku: string,
    readonly name: string,
    readonly description: string | undefined,
    readonly status: ProductStatus,
    readonly currency: string,
    readonly priceAmount: number,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly sku: string;
    readonly name: string;
    readonly description?: string;
    readonly status?: string;
    readonly currency?: string;
    readonly priceAmount: number;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: ProductId;
  }): Product {
    if (!input.organizationId.trim()) {
      throw new InvalidProductError('Organization is required');
    }
    const description = input.description?.trim();
    if (description && description.length > 4_000) {
      throw new InvalidProductError('Description must be at most 4000 characters');
    }
    return new Product(
      input.id ?? createProductId(),
      input.organizationId,
      normalizeSku(input.sku),
      normalizeName(input.name, 'Product name', 200),
      description || undefined,
      parseProductStatus(input.status),
      normalizeCurrency(input.currency),
      normalizeMoney(input.priceAmount, 'Price'),
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: ProductSnapshot): Product {
    return new Product(
      snapshot.id,
      snapshot.organizationId,
      snapshot.sku,
      snapshot.name,
      snapshot.description,
      snapshot.status,
      snapshot.currency,
      snapshot.priceAmount,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): ProductSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      sku: this.sku,
      name: this.name,
      description: this.description,
      status: this.status,
      currency: this.currency,
      priceAmount: this.priceAmount,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
