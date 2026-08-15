import type { OrderLineItemDto, OrderStatus } from '@ai-customer-support/contracts';
import { MAX_ORDER_LINE_ITEMS } from './customer-policy.js';
import { InvalidOrderError } from './errors.js';
import { createOrderId, type OrderId } from './ids.js';
import {
  normalizeCurrency,
  normalizeExternalId,
  normalizeMoney,
  normalizeName,
  normalizeSku,
  parseOptionalDate,
  parseOrderStatus,
} from './values.js';

export type OrderLineItem = {
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitAmount: number;
};

export type OrderSnapshot = {
  readonly id: OrderId;
  readonly organizationId: string;
  readonly customerId: string;
  readonly externalOrderId: string;
  readonly status: OrderStatus;
  readonly currency: string;
  readonly totalAmount: number;
  readonly lineItems: readonly OrderLineItem[];
  readonly placedAt: Date;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class CommerceOrder {
  private constructor(
    readonly id: OrderId,
    readonly organizationId: string,
    readonly customerId: string,
    readonly externalOrderId: string,
    readonly status: OrderStatus,
    readonly currency: string,
    readonly totalAmount: number,
    readonly lineItems: readonly OrderLineItem[],
    readonly placedAt: Date,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly customerId: string;
    readonly externalOrderId: string;
    readonly status?: string;
    readonly currency?: string;
    readonly totalAmount: number;
    readonly lineItems: readonly OrderLineItemDto[];
    readonly placedAt?: string | Date;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: OrderId;
  }): CommerceOrder {
    if (!input.organizationId.trim()) {
      throw new InvalidOrderError('Organization is required');
    }
    if (!input.customerId.trim()) {
      throw new InvalidOrderError('Customer is required');
    }
    const lineItems = parseLineItems(input.lineItems);
    return new CommerceOrder(
      input.id ?? createOrderId(),
      input.organizationId,
      input.customerId,
      normalizeExternalId(input.externalOrderId, 'Order id'),
      parseOrderStatus(input.status),
      normalizeCurrency(input.currency),
      normalizeMoney(input.totalAmount, 'Order total'),
      lineItems,
      parseOptionalDate(input.placedAt, 'placedAt') ?? input.now,
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: OrderSnapshot): CommerceOrder {
    return new CommerceOrder(
      snapshot.id,
      snapshot.organizationId,
      snapshot.customerId,
      snapshot.externalOrderId,
      snapshot.status,
      snapshot.currency,
      snapshot.totalAmount,
      snapshot.lineItems,
      snapshot.placedAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): OrderSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      customerId: this.customerId,
      externalOrderId: this.externalOrderId,
      status: this.status,
      currency: this.currency,
      totalAmount: this.totalAmount,
      lineItems: this.lineItems,
      placedAt: this.placedAt,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function parseLineItems(items: readonly OrderLineItemDto[]): readonly OrderLineItem[] {
  if (!Array.isArray(items) || items.length < 1) {
    throw new InvalidOrderError('At least one line item is required');
  }
  if (items.length > MAX_ORDER_LINE_ITEMS) {
    throw new InvalidOrderError(`An order can have at most ${MAX_ORDER_LINE_ITEMS} line items`);
  }
  return items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10_000) {
      throw new InvalidOrderError('Line item quantity must be an integer from 1 to 10000');
    }
    return {
      sku: normalizeSku(item.sku),
      name: normalizeName(item.name, 'Line item name', 200),
      quantity: item.quantity,
      unitAmount: normalizeMoney(item.unitAmount, 'Line item amount'),
    };
  });
}
