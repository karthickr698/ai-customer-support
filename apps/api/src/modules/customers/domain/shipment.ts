import type { ShipmentStatus } from '@ai-customer-support/contracts';
import { InvalidShipmentError } from './errors.js';
import { createShipmentId, type ShipmentId } from './ids.js';
import { normalizeExternalId, parseOptionalDate, parseShipmentStatus } from './values.js';

export type ShipmentSnapshot = {
  readonly id: ShipmentId;
  readonly organizationId: string;
  readonly orderId: string;
  readonly trackingNumber: string;
  readonly carrier: string;
  readonly status: ShipmentStatus;
  readonly shippedAt?: Date;
  readonly estimatedDeliveryAt?: Date;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class Shipment {
  private constructor(
    readonly id: ShipmentId,
    readonly organizationId: string,
    readonly orderId: string,
    readonly trackingNumber: string,
    readonly carrier: string,
    readonly status: ShipmentStatus,
    readonly shippedAt: Date | undefined,
    readonly estimatedDeliveryAt: Date | undefined,
    readonly createdByUserId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    readonly organizationId: string;
    readonly orderId: string;
    readonly trackingNumber: string;
    readonly carrier: string;
    readonly status?: string;
    readonly shippedAt?: string | Date;
    readonly estimatedDeliveryAt?: string | Date;
    readonly createdByUserId: string;
    readonly now: Date;
    readonly id?: ShipmentId;
  }): Shipment {
    if (!input.organizationId.trim()) {
      throw new InvalidShipmentError('Organization is required');
    }
    if (!input.orderId.trim()) {
      throw new InvalidShipmentError('Order is required');
    }
    const carrier = input.carrier.trim();
    if (carrier.length < 1 || carrier.length > 80) {
      throw new InvalidShipmentError('Carrier must be between 1 and 80 characters');
    }
    return new Shipment(
      input.id ?? createShipmentId(),
      input.organizationId,
      input.orderId,
      normalizeExternalId(input.trackingNumber, 'Tracking number'),
      carrier,
      parseShipmentStatus(input.status),
      parseOptionalDate(input.shippedAt, 'shippedAt'),
      parseOptionalDate(input.estimatedDeliveryAt, 'estimatedDeliveryAt'),
      input.createdByUserId,
      input.now,
      input.now,
    );
  }

  static reconstitute(snapshot: ShipmentSnapshot): Shipment {
    return new Shipment(
      snapshot.id,
      snapshot.organizationId,
      snapshot.orderId,
      snapshot.trackingNumber,
      snapshot.carrier,
      snapshot.status,
      snapshot.shippedAt,
      snapshot.estimatedDeliveryAt,
      snapshot.createdByUserId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  belongsTo(tenantId: string): boolean {
    return this.organizationId === tenantId;
  }

  toSnapshot(): ShipmentSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      orderId: this.orderId,
      trackingNumber: this.trackingNumber,
      carrier: this.carrier,
      status: this.status,
      shippedAt: this.shippedAt,
      estimatedDeliveryAt: this.estimatedDeliveryAt,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
