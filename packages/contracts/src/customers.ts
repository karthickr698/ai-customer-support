/**
 * Cross-runtime DTOs for tenant-scoped commerce records used by support lookup tools.
 */

export const CUSTOMER_STATUSES = ['active', 'disabled'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPMENT_STATUSES = ['pending', 'shipped', 'in_transit', 'delivered', 'exception'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const RETURN_STATUSES = ['requested', 'approved', 'received', 'refunded', 'rejected'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export type CustomerDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly name: string;
  readonly phone: string | null;
  readonly status: CustomerStatus;
  readonly externalCustomerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RegisterCustomerRequest = {
  readonly email: string;
  readonly name: string;
  readonly phone?: string;
  readonly status?: CustomerStatus;
  readonly externalCustomerId?: string;
};

export type CustomerResponse = {
  readonly customer: CustomerDto;
};

export type CustomerListResponse = {
  readonly items: readonly CustomerDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ProductDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly currency: string;
  readonly priceAmount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RegisterProductRequest = {
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly status?: ProductStatus;
  readonly currency?: string;
  readonly priceAmount: number;
};

export type ProductResponse = {
  readonly product: ProductDto;
};

export type ProductListResponse = {
  readonly items: readonly ProductDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type OrderLineItemDto = {
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitAmount: number;
};

export type OrderDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly customerId: string;
  readonly externalOrderId: string;
  readonly status: OrderStatus;
  readonly currency: string;
  readonly totalAmount: number;
  readonly lineItems: readonly OrderLineItemDto[];
  readonly placedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RegisterOrderRequest = {
  readonly customerId: string;
  readonly externalOrderId: string;
  readonly status?: OrderStatus;
  readonly currency?: string;
  readonly totalAmount: number;
  readonly lineItems: readonly OrderLineItemDto[];
  readonly placedAt?: string;
};

export type OrderResponse = {
  readonly order: OrderDto;
};

export type OrderListResponse = {
  readonly items: readonly OrderDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ShipmentDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly orderId: string;
  readonly trackingNumber: string;
  readonly carrier: string;
  readonly status: ShipmentStatus;
  readonly shippedAt: string | null;
  readonly estimatedDeliveryAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RegisterShipmentRequest = {
  readonly orderId: string;
  readonly trackingNumber: string;
  readonly carrier: string;
  readonly status?: ShipmentStatus;
  readonly shippedAt?: string;
  readonly estimatedDeliveryAt?: string;
};

export type ShipmentResponse = {
  readonly shipment: ShipmentDto;
};

export type ShipmentListResponse = {
  readonly items: readonly ShipmentDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ReturnDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly orderId: string;
  readonly status: ReturnStatus;
  readonly reason: string | null;
  readonly requestedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RegisterReturnRequest = {
  readonly orderId: string;
  readonly status?: ReturnStatus;
  readonly reason?: string;
  readonly requestedAt?: string;
};

export type ReturnResponse = {
  readonly returnRecord: ReturnDto;
};

export type ReturnListResponse = {
  readonly items: readonly ReturnDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};
