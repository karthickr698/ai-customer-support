import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Customer } from '../../domain/customer.js';
import type { CustomerId } from '../../domain/ids.js';
import type { CommerceOrder } from '../../domain/order.js';
import type { Product } from '../../domain/product.js';
import type { CommerceReturn } from '../../domain/return.js';
import type { Shipment } from '../../domain/shipment.js';
import type { OrderId, ProductId, ReturnId, ShipmentId } from '../../domain/ids.js';

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  findById(tenantId: string, customerId: CustomerId): Promise<Customer | null>;
  findByEmail(tenantId: string, email: string): Promise<Customer | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly email?: string; readonly query?: string },
  ): Promise<Page<Customer>>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface ProductRepository {
  save(product: Product): Promise<void>;
  findById(tenantId: string, productId: ProductId): Promise<Product | null>;
  findBySku(tenantId: string, sku: string): Promise<Product | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly sku?: string; readonly query?: string },
  ): Promise<Page<Product>>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface OrderRepository {
  save(order: CommerceOrder): Promise<void>;
  findById(tenantId: string, orderId: OrderId): Promise<CommerceOrder | null>;
  findByExternalId(tenantId: string, externalOrderId: string): Promise<CommerceOrder | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly customerId?: string; readonly externalOrderId?: string },
  ): Promise<Page<CommerceOrder>>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface ShipmentRepository {
  save(shipment: Shipment): Promise<void>;
  findById(tenantId: string, shipmentId: ShipmentId): Promise<Shipment | null>;
  findByTrackingNumber(tenantId: string, trackingNumber: string): Promise<Shipment | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly orderId?: string; readonly trackingNumber?: string },
  ): Promise<Page<Shipment>>;
  countByTenant(tenantId: string): Promise<number>;
}

export interface ReturnRepository {
  save(record: CommerceReturn): Promise<void>;
  findById(tenantId: string, returnId: ReturnId): Promise<CommerceReturn | null>;
  listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly orderId?: string },
  ): Promise<Page<CommerceReturn>>;
  countByTenant(tenantId: string): Promise<number>;
}

export type BusinessDataLookupPort = {
  lookupCustomer(
    tenantId: string,
    actorId: string,
    args: { readonly customerId?: string; readonly email?: string },
  ): Promise<Record<string, unknown>>;
  lookupProduct(
    tenantId: string,
    actorId: string,
    args: { readonly productId?: string; readonly sku?: string },
  ): Promise<Record<string, unknown>>;
  lookupOrder(
    tenantId: string,
    actorId: string,
    args: { readonly orderId: string },
  ): Promise<Record<string, unknown>>;
  lookupShipment(
    tenantId: string,
    actorId: string,
    args: { readonly shipmentId?: string; readonly trackingNumber?: string },
  ): Promise<Record<string, unknown>>;
  lookupReturn(
    tenantId: string,
    actorId: string,
    args: { readonly returnId?: string; readonly orderId?: string },
  ): Promise<Record<string, unknown>>;
};
