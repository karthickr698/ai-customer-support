import type {
  CompleteOAuthConnectorRequest,
  ConnectorCatalogResponse,
  ExecuteToolCallRequest,
  ExecuteToolCallResponse,
  IntegrationCredentialListResponse,
  IntegrationCredentialResponse,
  OAuthConnectorListResponse,
  OAuthConnectorResponse,
  StartOAuthConnectorResponse,
  ToolDefinitionListResponse,
  ToolInvocationListResponse,
  UpsertIntegrationCredentialRequest,
  UpsertOAuthConnectorRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

const EXECUTE_TIMEOUT_MS = 25_000;

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export const toolsApi = {
  list: (organizationId: string) =>
    apiClient.get<ToolDefinitionListResponse>(orgPath(organizationId, '/tools')),
  execute: (organizationId: string, body: ExecuteToolCallRequest) =>
    apiClient.post<ExecuteToolCallResponse>(orgPath(organizationId, '/tools/calls'), body, {
      timeoutMs: EXECUTE_TIMEOUT_MS,
    }),
  listInvocations: (organizationId: string, page: number, pageSize: number) =>
    apiClient.get<ToolInvocationListResponse>(orgPath(organizationId, '/tools/invocations'), {
      params: { page, pageSize },
    }),
  listCredentials: (organizationId: string) =>
    apiClient.get<IntegrationCredentialListResponse>(orgPath(organizationId, '/integrations/credentials')),
  upsertCredential: (organizationId: string, body: UpsertIntegrationCredentialRequest) =>
    apiClient.put<IntegrationCredentialResponse>(orgPath(organizationId, '/integrations/credentials'), body),
  revokeCredential: (organizationId: string, credentialId: string) =>
    apiClient.delete<void>(orgPath(organizationId, `/integrations/credentials/${credentialId}`)),
  listOAuth: (organizationId: string) =>
    apiClient.get<OAuthConnectorListResponse>(orgPath(organizationId, '/integrations/oauth')),
  upsertOAuth: (organizationId: string, body: UpsertOAuthConnectorRequest) =>
    apiClient.put<OAuthConnectorResponse>(orgPath(organizationId, '/integrations/oauth'), body),
  startOAuth: (organizationId: string, connectorId: string) =>
    apiClient.post<StartOAuthConnectorResponse>(
      orgPath(organizationId, `/integrations/oauth/${connectorId}/authorize`),
    ),
  completeOAuth: (organizationId: string, connectorId: string, body: CompleteOAuthConnectorRequest) =>
    apiClient.post<OAuthConnectorResponse>(
      orgPath(organizationId, `/integrations/oauth/${connectorId}/complete`),
      body,
    ),
  disconnectOAuth: (organizationId: string, connectorId: string) =>
    apiClient.delete<void>(orgPath(organizationId, `/integrations/oauth/${connectorId}`)),
  listConnectorCatalog: (organizationId: string) =>
    apiClient.get<ConnectorCatalogResponse>(orgPath(organizationId, '/connectors/catalog')),
};
