import type {
  CreateOrganizationApiKeyRequest,
  CreateSecuritySecretRequest,
  OrganizationApiKeyCreatedResponse,
  OrganizationApiKeyListResponse,
  OAuthApplicationCreatedResponse,
  OAuthApplicationListResponse,
  RevealSecuritySecretResponse,
  SecurityAuditLogListResponse,
  SecurityIpAllowlistResponse,
  SecurityPolicyResponse,
  SecurityRateLimitsResponse,
  SecuritySecretListResponse,
  UpdateSecurityPolicyRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export const securityApi = {
  policy: (organizationId: string) =>
    apiClient.get<SecurityPolicyResponse>(orgPath(organizationId, '/security/policy')),
  updatePolicy: (organizationId: string, body: UpdateSecurityPolicyRequest) =>
    apiClient.put<SecurityPolicyResponse>(orgPath(organizationId, '/security/policy'), body),
  ipAllowlist: (organizationId: string) =>
    apiClient.get<SecurityIpAllowlistResponse>(orgPath(organizationId, '/security/ip-allowlist')),
  addIp: (organizationId: string, cidr: string, label?: string) =>
    apiClient.post(orgPath(organizationId, '/security/ip-allowlist'), { cidr, label }),
  removeIp: (organizationId: string, entryId: string) =>
    apiClient.delete(orgPath(organizationId, `/security/ip-allowlist/${entryId}`)),
  secrets: (organizationId: string) =>
    apiClient.get<SecuritySecretListResponse>(orgPath(organizationId, '/security/secrets')),
  createSecret: (organizationId: string, body: CreateSecuritySecretRequest) =>
    apiClient.post(orgPath(organizationId, '/security/secrets'), body),
  revealSecret: (organizationId: string, secretId: string) =>
    apiClient.post<RevealSecuritySecretResponse>(orgPath(organizationId, `/security/secrets/${secretId}/reveal`)),
  revokeSecret: (organizationId: string, secretId: string) =>
    apiClient.delete(orgPath(organizationId, `/security/secrets/${secretId}`)),
  auditLogs: (organizationId: string, params?: { page?: number; pageSize?: number }) =>
    apiClient.get<SecurityAuditLogListResponse>(orgPath(organizationId, '/security/audit-logs'), { params }),
  rateLimits: (organizationId: string) =>
    apiClient.get<SecurityRateLimitsResponse>(orgPath(organizationId, '/security/rate-limits')),
  apiKeys: (organizationId: string) =>
    apiClient.get<OrganizationApiKeyListResponse>(orgPath(organizationId, '/api-keys')),
  createApiKey: (organizationId: string, body: CreateOrganizationApiKeyRequest) =>
    apiClient.post<OrganizationApiKeyCreatedResponse>(orgPath(organizationId, '/api-keys'), body),
  revokeApiKey: (organizationId: string, apiKeyId: string) =>
    apiClient.delete(orgPath(organizationId, `/api-keys/${apiKeyId}`)),
  oauthApps: (organizationId: string) =>
    apiClient.get<OAuthApplicationListResponse>(orgPath(organizationId, '/oauth/applications')),
  createOAuthApp: (organizationId: string, name: string, redirectUris: readonly string[]) =>
    apiClient.post<OAuthApplicationCreatedResponse>(orgPath(organizationId, '/oauth/applications'), {
      name,
      redirectUris,
    }),
  revokeOAuthApp: (organizationId: string, applicationId: string) =>
    apiClient.delete(orgPath(organizationId, `/oauth/applications/${applicationId}`)),
};
