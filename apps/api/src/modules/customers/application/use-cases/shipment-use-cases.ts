import type { EventBus, PageRequest } from '@ai-customer-support/shared';
import type { ShipmentListResponse, ShipmentResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { CustomerPolicy, MAX_SHIPMENTS_PER_TENANT } from '../../domain/customer-policy.js';
import {
  DuplicateShipmentError,
  InvalidShipmentError,
  OrderNotFoundError,
  ShipmentNotFoundError,
  TooManyCustomerRecordsError,
} from '../../domain/errors.js';
import { ShipmentRegisteredEvent } from '../../domain/events.js';
import { createShipmentId } from '../../domain/ids.js';
import { Shipment } from '../../domain/shipment.js';
import { isUuid, normalizeExternalId } from '../../domain/values.js';
import { toShipmentDto, type RequestSecurityContext } from '../dtos.js';
import type { OrderRepository, ShipmentRepository } from '../ports/repositories.js';
import type { ClockPort, TenantAccessPort } from '../ports/tenant-access-port.js';
import { findOrder } from './order-use-cases.js';

export class RegisterShipmentUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly shipments: ShipmentRepository,
    private readonly orders: OrderRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly orderId: string;
    readonly trackingNumber: string;
    readonly carrier: string;
    readonly status?: string;
    readonly shippedAt?: string;
    readonly estimatedDeliveryAt?: string;
    readonly security: RequestSecurityContext;
  }): Promise<ShipmentResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_MANAGE);
    const order = await findOrder(this.orders, actor.tenantId, input.orderId);
    if (!order || !order.belongsTo(actor.tenantId)) {
      throw new OrderNotFoundError();
    }
    const count = await this.shipments.countByTenant(actor.tenantId);
    if (count >= MAX_SHIPMENTS_PER_TENANT) {
      throw new TooManyCustomerRecordsError('shipments');
    }
    const shipment = Shipment.create({
      organizationId: actor.tenantId,
      orderId: order.id,
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
      status: input.status,
      shippedAt: input.shippedAt,
      estimatedDeliveryAt: input.estimatedDeliveryAt,
      createdByUserId: actor.actorId,
      now: this.clock.now(),
    });
    if (await this.shipments.findByTrackingNumber(actor.tenantId, shipment.trackingNumber)) {
      throw new DuplicateShipmentError();
    }
    await this.shipments.save(shipment);
    await this.eventBus.publish(
      new ShipmentRegisteredEvent(
        crypto.randomUUID(),
        shipment.createdAt,
        actor.tenantId,
        shipment.id,
        actor.actorId,
        input.security.correlationId,
      ),
    );
    return { shipment: toShipmentDto(shipment) };
  }
}

export class GetShipmentUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly shipments: ShipmentRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly shipmentId?: string;
    readonly trackingNumber?: string;
  }): Promise<ShipmentResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const shipment = await findShipment(this.shipments, actor.tenantId, input);
    if (!shipment || !shipment.belongsTo(actor.tenantId)) {
      throw new ShipmentNotFoundError();
    }
    return { shipment: toShipmentDto(shipment) };
  }
}

export class ListShipmentsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly shipments: ShipmentRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly page: PageRequest;
    readonly orderId?: string;
    readonly trackingNumber?: string;
  }): Promise<ShipmentListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    CustomerPolicy.assertPermission(actor.permissions, Permissions.CUSTOMER_READ);
    const result = await this.shipments.listByTenant(actor.tenantId, input.page, {
      orderId: input.orderId,
      trackingNumber: input.trackingNumber
        ? normalizeExternalId(input.trackingNumber, 'Tracking number')
        : undefined,
    });
    return {
      items: result.items.filter((item) => item.belongsTo(actor.tenantId)).map(toShipmentDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}

export async function findShipment(
  shipments: ShipmentRepository,
  tenantId: string,
  input: { readonly shipmentId?: string; readonly trackingNumber?: string },
): Promise<Shipment | null> {
  if (input.shipmentId) {
    if (!isUuid(input.shipmentId)) {
      throw new InvalidShipmentError('shipmentId must be a UUID');
    }
    return shipments.findById(tenantId, createShipmentId(input.shipmentId));
  }
  if (input.trackingNumber) {
    return shipments.findByTrackingNumber(
      tenantId,
      normalizeExternalId(input.trackingNumber, 'Tracking number'),
    );
  }
  throw new InvalidShipmentError('Provide shipmentId or trackingNumber');
}
