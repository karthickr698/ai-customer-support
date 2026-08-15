import {
  CustomerNotFoundError,
  OrderNotFoundError,
  ProductNotFoundError,
  ReturnNotFoundError,
  ShipmentNotFoundError,
} from '../../../domain/errors.js';
import { toCustomerDto, toOrderDto, toProductDto, toReturnDto, toShipmentDto } from '../../../application/dtos.js';
import type { BusinessDataLookupPort } from '../../../application/ports/repositories.js';
import type { CustomerRepository, OrderRepository, ProductRepository, ReturnRepository, ShipmentRepository } from '../../../application/ports/repositories.js';
import { findCustomer } from '../../../application/use-cases/customer-use-cases.js';
import { findOrder } from '../../../application/use-cases/order-use-cases.js';
import { findProduct } from '../../../application/use-cases/product-use-cases.js';
import { findReturn } from '../../../application/use-cases/return-use-cases.js';
import { findShipment } from '../../../application/use-cases/shipment-use-cases.js';
import { CustomerPolicy } from '../../../domain/customer-policy.js';
import { Permissions } from '../../../../organizations/domain/permissions.js';
import type { TenantAccessPort } from '../../../application/ports/tenant-access-port.js';

/**
 * Tenant-scoped lookup used by allowlisted platform tools.
 * Re-checks customer.read and never returns another organization's records.
 */
export class TenantBusinessDataLookupAdapter implements BusinessDataLookupPort {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly customers: CustomerRepository,
    private readonly products: ProductRepository,
    private readonly orders: OrderRepository,
    private readonly shipments: ShipmentRepository,
    private readonly returns: ReturnRepository,
  ) {}

  async lookupCustomer(
    tenantId: string,
    actorId: string,
    args: { readonly customerId?: string; readonly email?: string },
  ): Promise<Record<string, unknown>> {
    const actor = await this.requireRead(tenantId, actorId);
    try {
      const customer = await findCustomer(this.customers, actor.tenantId, args);
      if (!customer || !customer.belongsTo(actor.tenantId)) {
        throw new CustomerNotFoundError();
      }
      return { found: true, tenantId: actor.tenantId, customer: toCustomerDto(customer) };
    } catch (error: unknown) {
      if (error instanceof CustomerNotFoundError) {
        return {
          found: false,
          tenantId: actor.tenantId,
          customerId: args.customerId ?? null,
          email: args.email ?? null,
        };
      }
      throw error;
    }
  }

  async lookupProduct(
    tenantId: string,
    actorId: string,
    args: { readonly productId?: string; readonly sku?: string },
  ): Promise<Record<string, unknown>> {
    const actor = await this.requireRead(tenantId, actorId);
    try {
      const product = await findProduct(this.products, actor.tenantId, args);
      if (!product || !product.belongsTo(actor.tenantId)) {
        throw new ProductNotFoundError();
      }
      return { found: true, tenantId: actor.tenantId, product: toProductDto(product) };
    } catch (error: unknown) {
      if (error instanceof ProductNotFoundError) {
        return { found: false, tenantId: actor.tenantId, productId: args.productId ?? null, sku: args.sku ?? null };
      }
      throw error;
    }
  }

  async lookupOrder(
    tenantId: string,
    actorId: string,
    args: { readonly orderId: string },
  ): Promise<Record<string, unknown>> {
    const actor = await this.requireRead(tenantId, actorId);
    try {
      const order = await findOrder(this.orders, actor.tenantId, args.orderId);
      if (!order || !order.belongsTo(actor.tenantId)) {
        throw new OrderNotFoundError();
      }
      return { found: true, tenantId: actor.tenantId, order: toOrderDto(order) };
    } catch (error: unknown) {
      if (error instanceof OrderNotFoundError) {
        return { found: false, tenantId: actor.tenantId, orderId: args.orderId };
      }
      throw error;
    }
  }

  async lookupShipment(
    tenantId: string,
    actorId: string,
    args: { readonly shipmentId?: string; readonly trackingNumber?: string },
  ): Promise<Record<string, unknown>> {
    const actor = await this.requireRead(tenantId, actorId);
    try {
      const shipment = await findShipment(this.shipments, actor.tenantId, args);
      if (!shipment || !shipment.belongsTo(actor.tenantId)) {
        throw new ShipmentNotFoundError();
      }
      return { found: true, tenantId: actor.tenantId, shipment: toShipmentDto(shipment) };
    } catch (error: unknown) {
      if (error instanceof ShipmentNotFoundError) {
        return {
          found: false,
          tenantId: actor.tenantId,
          shipmentId: args.shipmentId ?? null,
          trackingNumber: args.trackingNumber ?? null,
        };
      }
      throw error;
    }
  }

  async lookupReturn(
    tenantId: string,
    actorId: string,
    args: { readonly returnId?: string; readonly orderId?: string },
  ): Promise<Record<string, unknown>> {
    const actor = await this.requireRead(tenantId, actorId);
    try {
      const record = await findReturn(this.returns, this.orders, actor.tenantId, args);
      if (!record || !record.belongsTo(actor.tenantId)) {
        throw new ReturnNotFoundError();
      }
      return { found: true, tenantId: actor.tenantId, return: toReturnDto(record) };
    } catch (error: unknown) {
      if (error instanceof ReturnNotFoundError) {
        return {
          found: false,
          tenantId: actor.tenantId,
          returnId: args.returnId ?? null,
          orderId: args.orderId ?? null,
        };
      }
      throw error;
    }
  }

  private async requireRead(tenantId: string, actorId: string) {
    const actor = await this.tenantAccess.loadActor(tenantId, actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    return actor;
  }
}
