import type {
  CustomerDto,
  OrderDto,
  ProductDto,
  ReturnDto,
  ShipmentDto,
} from '@ai-customer-support/contracts';
import type { Customer } from '../domain/customer.js';
import type { CommerceOrder } from '../domain/order.js';
import type { Product } from '../domain/product.js';
import type { CommerceReturn } from '../domain/return.js';
import type { Shipment } from '../domain/shipment.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export function toCustomerDto(customer: Customer): CustomerDto {
  const snapshot = customer.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    email: snapshot.email,
    name: snapshot.name,
    phone: snapshot.phone ?? null,
    status: snapshot.status,
    externalCustomerId: snapshot.externalCustomerId ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toProductDto(product: Product): ProductDto {
  const snapshot = product.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    sku: snapshot.sku,
    name: snapshot.name,
    description: snapshot.description ?? null,
    status: snapshot.status,
    currency: snapshot.currency,
    priceAmount: snapshot.priceAmount,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toOrderDto(order: CommerceOrder): OrderDto {
  const snapshot = order.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    customerId: snapshot.customerId,
    externalOrderId: snapshot.externalOrderId,
    status: snapshot.status,
    currency: snapshot.currency,
    totalAmount: snapshot.totalAmount,
    lineItems: snapshot.lineItems.map((item) => ({ ...item })),
    placedAt: snapshot.placedAt.toISOString(),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toShipmentDto(shipment: Shipment): ShipmentDto {
  const snapshot = shipment.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    orderId: snapshot.orderId,
    trackingNumber: snapshot.trackingNumber,
    carrier: snapshot.carrier,
    status: snapshot.status,
    shippedAt: snapshot.shippedAt?.toISOString() ?? null,
    estimatedDeliveryAt: snapshot.estimatedDeliveryAt?.toISOString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toReturnDto(record: CommerceReturn): ReturnDto {
  const snapshot = record.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    orderId: snapshot.orderId,
    status: snapshot.status,
    reason: snapshot.reason ?? null,
    requestedAt: snapshot.requestedAt.toISOString(),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
