import type { Page, PageRequest } from '@ai-customer-support/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { Customer, type CustomerSnapshot } from '../../../domain/customer.js';
import {
  createCustomerId,
  createOrderId,
  createProductId,
  createReturnId,
  createShipmentId,
  type CustomerId,
  type OrderId,
  type ProductId,
  type ReturnId,
  type ShipmentId,
} from '../../../domain/ids.js';
import { CommerceOrder, type OrderLineItem, type OrderSnapshot } from '../../../domain/order.js';
import { parseCustomerStatus, parseOrderStatus, parseProductStatus, parseReturnStatus, parseShipmentStatus } from '../../../domain/values.js';
import { Product, type ProductSnapshot } from '../../../domain/product.js';
import { CommerceReturn, type ReturnSnapshot } from '../../../domain/return.js';
import { Shipment, type ShipmentSnapshot } from '../../../domain/shipment.js';
import type {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  ReturnRepository,
  ShipmentRepository,
} from '../../../application/ports/repositories.js';

export class PostgresCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(customer: Customer): Promise<void> {
    const snapshot = customer.toSnapshot();
    const data = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      email: snapshot.email,
      name: snapshot.name,
      phone: snapshot.phone ?? null,
      status: snapshot.status,
      externalCustomerId: snapshot.externalCustomerId ?? null,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
    await this.prisma.customer.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        status: data.status,
        externalCustomerId: data.externalCustomerId,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, customerId: CustomerId): Promise<Customer | null> {
    const record = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: tenantId },
    });
    return record ? toCustomer(record) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findFirst({
      where: { organizationId: tenantId, email },
    });
    return record ? toCustomer(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly email?: string; readonly query?: string },
  ): Promise<Page<Customer>> {
    const where: Prisma.CustomerWhereInput = {
      organizationId: tenantId,
      ...(filter?.email ? { email: filter.email } : {}),
      ...(filter?.query
        ? {
            OR: [
              { name: { contains: filter.query, mode: 'insensitive' } },
              { email: { contains: filter.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return paginate(
      page,
      () => this.prisma.customer.count({ where }),
      () =>
        this.prisma.customer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toCustomer,
    );
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.customer.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(product: Product): Promise<void> {
    const snapshot = product.toSnapshot();
    const data = toProductRecord(snapshot);
    await this.prisma.product.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        status: data.status,
        currency: data.currency,
        priceAmount: data.priceAmount,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, productId: ProductId): Promise<Product | null> {
    const record = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: tenantId },
    });
    return record ? toProduct(record) : null;
  }

  async findBySku(tenantId: string, sku: string): Promise<Product | null> {
    const record = await this.prisma.product.findFirst({
      where: { organizationId: tenantId, sku },
    });
    return record ? toProduct(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly sku?: string; readonly query?: string },
  ): Promise<Page<Product>> {
    const where: Prisma.ProductWhereInput = {
      organizationId: tenantId,
      ...(filter?.sku ? { sku: filter.sku } : {}),
      ...(filter?.query
        ? {
            OR: [
              { name: { contains: filter.query, mode: 'insensitive' } },
              { sku: { contains: filter.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return paginate(
      page,
      () => this.prisma.product.count({ where }),
      () =>
        this.prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toProduct,
    );
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.product.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(order: CommerceOrder): Promise<void> {
    const snapshot = order.toSnapshot();
    const data = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      customerId: snapshot.customerId,
      externalOrderId: snapshot.externalOrderId,
      status: snapshot.status,
      currency: snapshot.currency,
      totalAmount: snapshot.totalAmount,
      lineItems: snapshot.lineItems as unknown as Prisma.InputJsonValue,
      placedAt: snapshot.placedAt,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
    await this.prisma.commerceOrder.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        currency: data.currency,
        totalAmount: data.totalAmount,
        lineItems: data.lineItems,
        placedAt: data.placedAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, orderId: OrderId): Promise<CommerceOrder | null> {
    const record = await this.prisma.commerceOrder.findFirst({
      where: { id: orderId, organizationId: tenantId },
    });
    return record ? toOrder(record) : null;
  }

  async findByExternalId(tenantId: string, externalOrderId: string): Promise<CommerceOrder | null> {
    const record = await this.prisma.commerceOrder.findFirst({
      where: { organizationId: tenantId, externalOrderId },
    });
    return record ? toOrder(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly customerId?: string; readonly externalOrderId?: string },
  ): Promise<Page<CommerceOrder>> {
    const where: Prisma.CommerceOrderWhereInput = {
      organizationId: tenantId,
      ...(filter?.customerId ? { customerId: filter.customerId } : {}),
      ...(filter?.externalOrderId ? { externalOrderId: filter.externalOrderId } : {}),
    };
    return paginate(
      page,
      () => this.prisma.commerceOrder.count({ where }),
      () =>
        this.prisma.commerceOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toOrder,
    );
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.commerceOrder.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresShipmentRepository implements ShipmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(shipment: Shipment): Promise<void> {
    const snapshot = shipment.toSnapshot();
    const data = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      orderId: snapshot.orderId,
      trackingNumber: snapshot.trackingNumber,
      carrier: snapshot.carrier,
      status: snapshot.status,
      shippedAt: snapshot.shippedAt ?? null,
      estimatedDeliveryAt: snapshot.estimatedDeliveryAt ?? null,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
    await this.prisma.shipment.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        trackingNumber: data.trackingNumber,
        carrier: data.carrier,
        status: data.status,
        shippedAt: data.shippedAt,
        estimatedDeliveryAt: data.estimatedDeliveryAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, shipmentId: ShipmentId): Promise<Shipment | null> {
    const record = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId: tenantId },
    });
    return record ? toShipment(record) : null;
  }

  async findByTrackingNumber(tenantId: string, trackingNumber: string): Promise<Shipment | null> {
    const record = await this.prisma.shipment.findFirst({
      where: { organizationId: tenantId, trackingNumber },
    });
    return record ? toShipment(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly orderId?: string; readonly trackingNumber?: string },
  ): Promise<Page<Shipment>> {
    const where: Prisma.ShipmentWhereInput = {
      organizationId: tenantId,
      ...(filter?.orderId ? { orderId: filter.orderId } : {}),
      ...(filter?.trackingNumber ? { trackingNumber: filter.trackingNumber } : {}),
    };
    return paginate(
      page,
      () => this.prisma.shipment.count({ where }),
      () =>
        this.prisma.shipment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toShipment,
    );
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.shipment.count({ where: { organizationId: tenantId } });
  }
}

export class PostgresReturnRepository implements ReturnRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(record: CommerceReturn): Promise<void> {
    const snapshot = record.toSnapshot();
    const data = {
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      orderId: snapshot.orderId,
      status: snapshot.status,
      reason: snapshot.reason ?? null,
      requestedAt: snapshot.requestedAt,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
    await this.prisma.commerceReturn.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        status: data.status,
        reason: data.reason,
        requestedAt: data.requestedAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(tenantId: string, returnId: ReturnId): Promise<CommerceReturn | null> {
    const record = await this.prisma.commerceReturn.findFirst({
      where: { id: returnId, organizationId: tenantId },
    });
    return record ? toReturn(record) : null;
  }

  async listByTenant(
    tenantId: string,
    page: PageRequest,
    filter?: { readonly orderId?: string },
  ): Promise<Page<CommerceReturn>> {
    const where: Prisma.CommerceReturnWhereInput = {
      organizationId: tenantId,
      ...(filter?.orderId ? { orderId: filter.orderId } : {}),
    };
    return paginate(
      page,
      () => this.prisma.commerceReturn.count({ where }),
      () =>
        this.prisma.commerceReturn.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: skip(page),
          take: page.pageSize,
        }),
      toReturn,
    );
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.commerceReturn.count({ where: { organizationId: tenantId } });
  }
}

function skip(page: PageRequest): number {
  return (page.page - 1) * page.pageSize;
}

async function paginate<TRecord, TEntity>(
  page: PageRequest,
  count: () => Promise<number>,
  load: () => Promise<TRecord[]>,
  map: (record: TRecord) => TEntity,
): Promise<Page<TEntity>> {
  const [total, records] = await Promise.all([count(), load()]);
  return {
    items: records.map(map),
    total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

function toCustomer(record: {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  externalCustomerId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): Customer {
  const snapshot: CustomerSnapshot = {
    id: createCustomerId(record.id),
    organizationId: record.organizationId,
    email: record.email,
    name: record.name,
    phone: record.phone ?? undefined,
    status: parseCustomerStatus(record.status),
    externalCustomerId: record.externalCustomerId ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return Customer.reconstitute(snapshot);
}

function toProductRecord(snapshot: ProductSnapshot) {
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    sku: snapshot.sku,
    name: snapshot.name,
    description: snapshot.description ?? null,
    status: snapshot.status,
    currency: snapshot.currency,
    priceAmount: snapshot.priceAmount,
    createdByUserId: snapshot.createdByUserId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toProduct(record: {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description: string | null;
  status: string;
  currency: string;
  priceAmount: number;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  const snapshot: ProductSnapshot = {
    id: createProductId(record.id),
    organizationId: record.organizationId,
    sku: record.sku,
    name: record.name,
    description: record.description ?? undefined,
    status: parseProductStatus(record.status),
    currency: record.currency,
    priceAmount: record.priceAmount,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return Product.reconstitute(snapshot);
}

function toOrder(record: {
  id: string;
  organizationId: string;
  customerId: string;
  externalOrderId: string;
  status: string;
  currency: string;
  totalAmount: number;
  lineItems: Prisma.JsonValue;
  placedAt: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): CommerceOrder {
  const snapshot: OrderSnapshot = {
    id: createOrderId(record.id),
    organizationId: record.organizationId,
    customerId: record.customerId,
    externalOrderId: record.externalOrderId,
    status: parseOrderStatus(record.status),
    currency: record.currency,
    totalAmount: record.totalAmount,
    lineItems: parseLineItems(record.lineItems),
    placedAt: record.placedAt,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return CommerceOrder.reconstitute(snapshot);
}

function parseLineItems(value: Prisma.JsonValue): readonly OrderLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.sku !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.quantity !== 'number' ||
      typeof row.unitAmount !== 'number'
    ) {
      return [];
    }
    return [
      {
        sku: row.sku,
        name: row.name,
        quantity: row.quantity,
        unitAmount: row.unitAmount,
      },
    ];
  });
}

function toShipment(record: {
  id: string;
  organizationId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  shippedAt: Date | null;
  estimatedDeliveryAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): Shipment {
  const snapshot: ShipmentSnapshot = {
    id: createShipmentId(record.id),
    organizationId: record.organizationId,
    orderId: record.orderId,
    trackingNumber: record.trackingNumber,
    carrier: record.carrier,
    status: parseShipmentStatus(record.status),
    shippedAt: record.shippedAt ?? undefined,
    estimatedDeliveryAt: record.estimatedDeliveryAt ?? undefined,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return Shipment.reconstitute(snapshot);
}

function toReturn(record: {
  id: string;
  organizationId: string;
  orderId: string;
  status: string;
  reason: string | null;
  requestedAt: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): CommerceReturn {
  const snapshot: ReturnSnapshot = {
    id: createReturnId(record.id),
    organizationId: record.organizationId,
    orderId: record.orderId,
    status: parseReturnStatus(record.status),
    reason: record.reason ?? undefined,
    requestedAt: record.requestedAt,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return CommerceReturn.reconstitute(snapshot);
}
