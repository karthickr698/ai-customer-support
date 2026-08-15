import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type { OrderLineItemDto, OrderListResponse, OrderResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { CustomerPolicy, MAX_ORDERS_PER_TENANT } from '../../domain/customer-policy.js';
import {
  CustomerNotFoundError,
  DuplicateOrderError,
  InvalidOrderError,
  OrderNotFoundError,
  TooManyCustomerRecordsError,
} from '../../domain/errors.js';
import { OrderRegisteredEvent } from '../../domain/events.js';
import { createCustomerId, createOrderId } from '../../domain/ids.js';
import { CommerceOrder } from '../../domain/order.js';
import { isUuid, normalizeExternalId } from '../../domain/values.js';
import { toOrderDto, type RequestSecurityContext } from '../dtos.js';
import type { CustomerRepository, OrderRepository } from '../ports/repositories.js';
import type { ClockPort, TenantAccessPort } from '../ports/tenant-access-port.js';

export class RegisterOrderUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly orders: OrderRepository,
    private readonly customers: CustomerRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly customerId: string;
    readonly externalOrderId: string;
    readonly status?: string;
    readonly currency?: string;
    readonly totalAmount: number;
    readonly lineItems: readonly OrderLineItemDto[];
    readonly placedAt?: string;
    readonly security: RequestSecurityContext;
  }): Promise<OrderResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_MANAGE);
    if (!isUuid(input.customerId)) {
      throw new InvalidOrderError('customerId must be a UUID');
    }
    const customer = await this.customers.findById(actor.tenantId, createCustomerId(input.customerId));
    if (!customer || !customer.belongsTo(actor.tenantId)) {
      throw new CustomerNotFoundError();
    }
    const count = await this.orders.countByTenant(actor.tenantId);
    if (count >= MAX_ORDERS_PER_TENANT) {
      throw new TooManyCustomerRecordsError('orders');
    }
    const order = CommerceOrder.create({
      organizationId: actor.tenantId,
      customerId: customer.id,
      externalOrderId: input.externalOrderId,
      status: input.status,
      currency: input.currency,
      totalAmount: input.totalAmount,
      lineItems: input.lineItems,
      placedAt: input.placedAt,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    if (await this.orders.findByExternalId(actor.tenantId, order.externalOrderId)) {
      throw new DuplicateOrderError();
    }
    await this.orders.save(order);
    await this.eventBus.publish(
      new OrderRegisteredEvent(
        crypto.randomUUID(),
        order.createdAt,
        actor.tenantId,
        order.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { order: toOrderDto(order) };
  }
}

export class GetOrderUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly orders: OrderRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly orderId: string;
  }): Promise<OrderResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const order = await findOrder(this.orders, actor.tenantId, input.orderId);
    if (!order || !order.belongsTo(actor.tenantId)) {
      throw new OrderNotFoundError();
    }
    return { order: toOrderDto(order) };
  }
}

export class ListOrdersUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly orders: OrderRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly customerId?: string;
    readonly externalOrderId?: string;
  }): Promise<OrderListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    if (input.customerId && !isUuid(input.customerId)) {
      throw new InvalidOrderError('customerId must be a UUID');
    }
    const result = await this.orders.listByTenant(actor.tenantId, input.page, {
      customerId: input.customerId,
      externalOrderId: input.externalOrderId
        ? normalizeExternalId(input.externalOrderId, 'Order id')
        : undefined,
    });
    return {
      items: result.items.filter((item) => item.belongsTo(actor.tenantId)).map(toOrderDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export async function findOrder(
  orders: OrderRepository,
  tenantId: string,
  orderId: string,
): Promise<CommerceOrder | null> {
  const trimmed = orderId.trim();
  if (!trimmed) {
    throw new InvalidOrderError('orderId is required');
  }
  if (isUuid(trimmed)) {
    const byId = await orders.findById(tenantId, createOrderId(trimmed));
    if (byId) {
      return byId;
    }
  }
  return orders.findByExternalId(tenantId, normalizeExternalId(trimmed, 'Order id'));
}
