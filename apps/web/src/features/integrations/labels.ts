import type {
  ConnectorCategory,
  ConnectorConnectionStatus,
  ConnectorHealthStatus,
  ConnectorKind,
  CustomerStatus,
  OrderStatus,
  ProductStatus,
  ReturnStatus,
  ShipmentStatus,
} from '@ai-customer-support/contracts';
import {
  CUSTOMER_STATUSES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  RETURN_STATUSES,
  SHIPMENT_STATUSES,
} from '@ai-customer-support/contracts';

export function integrationsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/integrations`;
  return segment ? `${base}/${segment}` : base;
}

export function connectorKindLabel(kind: ConnectorKind): string {
  return kind === 'oauth' ? 'OAuth' : 'HTTP';
}

export function connectorCategoryLabel(category: ConnectorCategory): string {
  switch (category) {
    case 'commerce':
      return 'Commerce';
    case 'payments':
      return 'Payments';
    case 'support':
      return 'Support';
    case 'custom':
      return 'Custom';
  }
}

export function connectionStatusLabel(status: ConnectorConnectionStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'connected':
      return 'Connected';
    case 'expired':
      return 'Expired';
    case 'disconnected':
      return 'Disconnected';
  }
}

export function connectionStatusVariant(
  status: ConnectorConnectionStatus,
): 'secondary' | 'success' | 'warning' | 'outline' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'connected':
      return 'success';
    case 'expired':
      return 'warning';
    case 'disconnected':
      return 'outline';
  }
}

export function healthStatusLabel(status: ConnectorHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'unhealthy':
      return 'Unhealthy';
    case 'unknown':
      return 'Unknown';
    case 'disconnected':
      return 'Disconnected';
  }
}

export function healthStatusVariant(
  status: ConnectorHealthStatus,
): 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'unhealthy':
      return 'destructive';
    case 'unknown':
      return 'secondary';
    case 'disconnected':
      return 'outline';
  }
}

export type CommerceDataset = 'customers' | 'products' | 'orders' | 'returns' | 'shipping';

export const COMMERCE_PAGE_SIZE = 20;

export function commerceDatasetLabel(dataset: CommerceDataset): string {
  switch (dataset) {
    case 'customers':
      return 'Customers';
    case 'products':
      return 'Products';
    case 'orders':
      return 'Orders';
    case 'returns':
      return 'Returns';
    case 'shipping':
      return 'Shipping';
  }
}

export function customerStatusLabel(status: CustomerStatus): string {
  return status === 'active' ? 'Active' : 'Disabled';
}

export function customerStatusVariant(status: CustomerStatus): 'success' | 'secondary' {
  return status === 'active' ? 'success' : 'secondary';
}

export function productStatusLabel(status: ProductStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'active':
      return 'Active';
    case 'archived':
      return 'Archived';
  }
}

export function productStatusVariant(status: ProductStatus): 'secondary' | 'success' | 'outline' {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'active':
      return 'success';
    case 'archived':
      return 'outline';
  }
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'paid':
      return 'Paid';
    case 'fulfilled':
      return 'Fulfilled';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
  }
}

export function orderStatusVariant(
  status: OrderStatus,
): 'secondary' | 'success' | 'warning' | 'outline' | 'destructive' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'paid':
      return 'success';
    case 'fulfilled':
      return 'success';
    case 'cancelled':
      return 'outline';
    case 'refunded':
      return 'warning';
  }
}

export function shipmentStatusLabel(status: ShipmentStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'shipped':
      return 'Shipped';
    case 'in_transit':
      return 'In transit';
    case 'delivered':
      return 'Delivered';
    case 'exception':
      return 'Exception';
  }
}

export function shipmentStatusVariant(
  status: ShipmentStatus,
): 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'shipped':
      return 'success';
    case 'in_transit':
      return 'warning';
    case 'delivered':
      return 'success';
    case 'exception':
      return 'destructive';
  }
}

export function returnStatusLabel(status: ReturnStatus): string {
  switch (status) {
    case 'requested':
      return 'Requested';
    case 'approved':
      return 'Approved';
    case 'received':
      return 'Received';
    case 'refunded':
      return 'Refunded';
    case 'rejected':
      return 'Rejected';
  }
}

export function returnStatusVariant(
  status: ReturnStatus,
): 'secondary' | 'success' | 'warning' | 'outline' | 'destructive' {
  switch (status) {
    case 'requested':
      return 'secondary';
    case 'approved':
      return 'success';
    case 'received':
      return 'warning';
    case 'refunded':
      return 'success';
    case 'rejected':
      return 'destructive';
  }
}

export function formatMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

export const DATASET_CONNECTOR_PERMISSIONS: Record<CommerceDataset, readonly string[]> = {
  customers: ['read_customers', 'users:read', 'getCustomerDetails'],
  products: ['getProductDetails', 'read_products'],
  orders: ['read_orders', 'getOrderDetails'],
  returns: ['read_refunds', 'checkRefundStatus', 'getReturnDetails'],
  shipping: ['read_fulfillments', 'getShipmentDetails'],
};

export const CUSTOMER_STATUS_OPTIONS = CUSTOMER_STATUSES.map((value) => ({
  value,
  label: customerStatusLabel(value),
}));

export const PRODUCT_STATUS_OPTIONS = PRODUCT_STATUSES.map((value) => ({
  value,
  label: productStatusLabel(value),
}));

export const ORDER_STATUS_OPTIONS = ORDER_STATUSES.map((value) => ({
  value,
  label: orderStatusLabel(value),
}));

export const SHIPMENT_STATUS_OPTIONS = SHIPMENT_STATUSES.map((value) => ({
  value,
  label: shipmentStatusLabel(value),
}));

export const RETURN_STATUS_OPTIONS = RETURN_STATUSES.map((value) => ({
  value,
  label: returnStatusLabel(value),
}));
