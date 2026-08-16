import type {
  CompleteConnectorOAuthRequest,
  ConnectorCatalogItemResponse,
  ConnectorCatalogResponse,
  ConnectorConnectionListResponse,
  ConnectorConnectionResponse,
  ConnectorHealthResponse,
  SetupConnectorRequest,
  SetupConnectorResponse,
  StartConnectorOAuthResponse,
  UpdateConnectorPermissionsRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

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
