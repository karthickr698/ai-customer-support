import type {
  ChangeMemberRoleRequest,
  CreateOrganizationRequest,
  InvitationPreviewResponse,
  InviteMemberRequest,
  OrganizationAuditLogListResponse,
  OrganizationInvitationResponse,
  OrganizationInvitationsResponse,
  OrganizationListResponse,
  OrganizationMembersResponse,
  OrganizationResponse,
  UpdateOrganizationRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

export const organizationsApi = {
  list: () => apiClient.get<OrganizationListResponse>('/api/organizations'),
  create: (body: CreateOrganizationRequest) =>
    apiClient.post<OrganizationResponse>('/api/organizations', body),
  get: (organizationId: string) =>
    apiClient.get<OrganizationResponse>(`/api/organizations/${organizationId}`),
  update: (organizationId: string, body: UpdateOrganizationRequest) =>
    apiClient.patch<OrganizationResponse>(`/api/organizations/${organizationId}`, body),
  members: (organizationId: string) =>
    apiClient.get<OrganizationMembersResponse>(`/api/organizations/${organizationId}/members`),
  changeRole: (organizationId: string, membershipId: string, body: ChangeMemberRoleRequest) =>
    apiClient.patch<{ member: OrganizationMembersResponse['members'][number] }>(
      `/api/organizations/${organizationId}/members/${membershipId}`,
      body,
    ),
  removeMember: (organizationId: string, membershipId: string) =>
    apiClient.delete<void>(`/api/organizations/${organizationId}/members/${membershipId}`),
  leave: (organizationId: string) =>
    apiClient.post<void>(`/api/organizations/${organizationId}/leave`),
  invitations: (organizationId: string) =>
    apiClient.get<OrganizationInvitationsResponse>(`/api/organizations/${organizationId}/invitations`),
  invite: (organizationId: string, body: InviteMemberRequest) =>
    apiClient.post<OrganizationInvitationResponse>(`/api/organizations/${organizationId}/invitations`, body),
  revokeInvitation: (organizationId: string, invitationId: string) =>
    apiClient.delete<void>(`/api/organizations/${organizationId}/invitations/${invitationId}`),
  previewInvitation: (token: string) =>
    apiClient.get<InvitationPreviewResponse>(`/api/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string) =>
    apiClient.post<OrganizationResponse>('/api/invitations/accept', { token }),
  auditLogs: (organizationId: string, page = 1) =>
    apiClient.get<OrganizationAuditLogListResponse>(`/api/organizations/${organizationId}/audit-logs`, {
      params: { page, pageSize: 20 },
    }),
};
