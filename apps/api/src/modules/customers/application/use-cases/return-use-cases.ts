import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type { ReturnListResponse, ReturnResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { CustomerPolicy, MAX_RETURNS_PER_TENANT } from '../../domain/customer-policy.js';
import {
  InvalidReturnError,
  OrderNotFoundError,
  ReturnNotFoundError,
  TooManyCustomerRecordsError,
} from '../../domain/errors.js';
import { ReturnRegisteredEvent } from '../../domain/events.js';
import { createReturnId } from '../../domain/ids.js';
import { CommerceReturn } from '../../domain/return.js';
import { isUuid } from '../../domain/values.js';
import { toReturnDto, type RequestSecurityContext } from '../dtos.js';
import type { OrderRepository, ReturnRepository } from '../ports/repositories.js';
import type { ClockPort, TenantAccessPort } from '../ports/tenant-access-port.js';
import { findOrder } from './order-use-cases.js';

export class RegisterReturnUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly returns: ReturnRepository,
    private readonly orders: OrderRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly orderId: string;
    readonly status?: string;
    readonly reason?: string;
    readonly requestedAt?: string;
    readonly security: RequestSecurityContext;
  }): Promise<ReturnResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_MANAGE);
    const order = await findOrder(this.orders, actor.tenantId, input.orderId);
    if (!order || !order.belongsTo(actor.tenantId)) {
      throw new OrderNotFoundError();
    }
    const count = await this.returns.countByTenant(actor.tenantId);
    if (count >= MAX_RETURNS_PER_TENANT) {
      throw new TooManyCustomerRecordsError('returns');
    }
    const record = CommerceReturn.create({
      organizationId: actor.tenantId,
      orderId: order.id,
      status: input.status,
      reason: input.reason,
      requestedAt: input.requestedAt,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    await this.returns.save(record);
    await this.eventBus.publish(
      new ReturnRegisteredEvent(
        crypto.randomUUID(),
        record.createdAt,
        actor.tenantId,
        record.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { returnRecord: toReturnDto(record) };
  }
}

export class GetReturnUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly returns: ReturnRepository,
    private readonly orders: OrderRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly returnId?: string;
    readonly orderId?: string;
  }): Promise<ReturnResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const record = await findReturn(this.returns, this.orders, actor.tenantId, input);
    if (!record || !record.belongsTo(actor.tenantId)) {
      throw new ReturnNotFoundError();
    }
    return { returnRecord: toReturnDto(record) };
  }
}

export class ListReturnsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly returns: ReturnRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly orderId?: string;
  }): Promise<ReturnListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const result = await this.returns.listByTenant(actor.tenantId, input.page, {
      orderId: input.orderId,
    });
    return {
      items: result.items.filter((item) => item.belongsTo(actor.tenantId)).map(toReturnDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export async function findReturn(
  returns: ReturnRepository,
  orders: OrderRepository,
  tenantId: string,
  input: { readonly returnId?: string; readonly orderId?: string },
): Promise<CommerceReturn | null> {
  if (input.returnId) {
    if (!isUuid(input.returnId)) {
      throw new InvalidReturnError('returnId must be a UUID');
    }
    return returns.findById(tenantId, createReturnId(input.returnId));
  }
  if (input.orderId) {
    const order = await findOrder(orders, tenantId, input.orderId);
    if (!order || !order.belongsTo(tenantId)) {
      return null;
    }
    const page = await returns.listByTenant(tenantId, { page: 1, pageSize: 1 }, { orderId: order.id });
    return page.items[0] ?? null;
  }
  throw new InvalidReturnError('Provide returnId or orderId');
}
