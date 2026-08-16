import type {
  CompleteConnectorOAuthRequest,
  ConnectorCatalogItemResponse,
  ConnectorCatalogResponse,
  ConnectorConnectionListResponse,
  ConnectorConnectionResponse,
  ConnectorHealthResponse,
  CustomerListResponse,
  CustomerResponse,
  OrderListResponse,
  OrderResponse,
  ProductListResponse,
  ProductResponse,
  RegisterCustomerRequest,
  RegisterOrderRequest,
  RegisterProductRequest,
  RegisterReturnRequest,
  RegisterShipmentRequest,
  ReturnListResponse,
  ReturnResponse,
  SetupConnectorRequest,
  SetupConnectorResponse,
  ShipmentListResponse,
  ShipmentResponse,
  StartConnectorOAuthResponse,
  UpdateConnectorPermissionsRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export type CustomerListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly q?: string;
  readonly email?: string;
};

export type ProductListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly q?: string;
  readonly sku?: string;
};

export type OrderListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly customerId?: string;
  readonly externalOrderId?: string;
};

export type ShipmentListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly orderId?: string;
  readonly trackingNumber?: string;
};

export type ReturnListParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly orderId?: string;
};

export const integrationsApi = {
  listCatalog: (
    organizationId: string,
    params?: { q?: string; kind?: string; category?: string },
  ) =>
    apiClient.get<ConnectorCatalogResponse>(orgPath(organizationId, '/connectors/catalog'), { params }),
  getCatalogItem: (organizationId: string, catalogId: string) =>
    apiClient.get<ConnectorCatalogItemResponse>(orgPath(organizationId, `/connectors/catalog/${catalogId}`)),
  listConnections: (
    organizationId: string,
    params?: { q?: string; kind?: string; status?: string },
  ) => apiClient.get<ConnectorConnectionListResponse>(orgPath(organizationId, '/connectors'), { params }),
  getConnection: (organizationId: string, connectionId: string) =>
    apiClient.get<ConnectorConnectionResponse>(orgPath(organizationId, `/connectors/${connectionId}`)),
  setup: (organizationId: string, body: SetupConnectorRequest) =>
    apiClient.post<SetupConnectorResponse>(orgPath(organizationId, '/connectors/setup'), body),
  startOAuth: (organizationId: string, connectionId: string) =>
    apiClient.post<StartConnectorOAuthResponse>(
      orgPath(organizationId, `/connectors/${connectionId}/oauth/authorize`),
    ),
  completeOAuth: (organizationId: string, connectionId: string, body: CompleteConnectorOAuthRequest) =>
    apiClient.post<ConnectorConnectionResponse>(
      orgPath(organizationId, `/connectors/${connectionId}/oauth/complete`),
      body,
    ),
  probeHealth: (organizationId: string, connectionId: string) =>
    apiClient.post<ConnectorHealthResponse>(orgPath(organizationId, `/connectors/${connectionId}/health`)),
  updatePermissions: (
    organizationId: string,
    connectionId: string,
    body: UpdateConnectorPermissionsRequest,
  ) =>
    apiClient.patch<ConnectorConnectionResponse>(
      orgPath(organizationId, `/connectors/${connectionId}/permissions`),
      body,
    ),
  disconnect: (organizationId: string, connectionId: string) =>
    apiClient.delete<void>(orgPath(organizationId, `/connectors/${connectionId}`)),
};

export const commerceApi = {
  listCustomers: (organizationId: string, params?: CustomerListParams) =>
    apiClient.get<CustomerListResponse>(orgPath(organizationId, '/customers'), { params }),
  getCustomer: (organizationId: string, customerId: string) =>
    apiClient.get<CustomerResponse>(orgPath(organizationId, `/customers/${customerId}`)),
  registerCustomer: (organizationId: string, body: RegisterCustomerRequest) =>
    apiClient.post<CustomerResponse>(orgPath(organizationId, '/customers'), body),

  listProducts: (organizationId: string, params?: ProductListParams) =>
    apiClient.get<ProductListResponse>(orgPath(organizationId, '/products'), { params }),
  getProduct: (organizationId: string, productId: string) =>
    apiClient.get<ProductResponse>(orgPath(organizationId, `/products/${productId}`)),
  registerProduct: (organizationId: string, body: RegisterProductRequest) =>
    apiClient.post<ProductResponse>(orgPath(organizationId, '/products'), body),

  listOrders: (organizationId: string, params?: OrderListParams) =>
    apiClient.get<OrderListResponse>(orgPath(organizationId, '/orders'), { params }),
  getOrder: (organizationId: string, orderId: string) =>
    apiClient.get<OrderResponse>(orgPath(organizationId, `/orders/${orderId}`)),
  registerOrder: (organizationId: string, body: RegisterOrderRequest) =>
    apiClient.post<OrderResponse>(orgPath(organizationId, '/orders'), body),

  listShipments: (organizationId: string, params?: ShipmentListParams) =>
    apiClient.get<ShipmentListResponse>(orgPath(organizationId, '/shipments'), { params }),
  getShipment: (organizationId: string, shipmentId: string) =>
    apiClient.get<ShipmentResponse>(orgPath(organizationId, `/shipments/${shipmentId}`)),
  registerShipment: (organizationId: string, body: RegisterShipmentRequest) =>
    apiClient.post<ShipmentResponse>(orgPath(organizationId, '/shipments'), body),

  listReturns: (organizationId: string, params?: ReturnListParams) =>
    apiClient.get<ReturnListResponse>(orgPath(organizationId, '/returns'), { params }),
  getReturn: (organizationId: string, returnId: string) =>
    apiClient.get<ReturnResponse>(orgPath(organizationId, `/returns/${returnId}`)),
  registerReturn: (organizationId: string, body: RegisterReturnRequest) =>
    apiClient.post<ReturnResponse>(orgPath(organizationId, '/returns'), body),
};
