import type {
  NotificationInboxItemResponse,
  NotificationInboxListResponse,
  NotificationPreferenceListResponse,
  NotificationTemplateListResponse,
  SendNotificationResponse,
  UpsertNotificationPreferencesRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

function orgPath(organizationId: string, suffix: string): string {
  return `/api/organizations/${organizationId}${suffix}`;
}

export const notificationsApi = {
  inbox: (organizationId: string, params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) =>
    apiClient.get<NotificationInboxListResponse>(orgPath(organizationId, '/notifications/inbox'), {
      params: {
        page: params?.page,
        pageSize: params?.pageSize,
        unreadOnly: params?.unreadOnly ? 'true' : undefined,
      },
    }),
  markRead: (organizationId: string, itemId: string) =>
    apiClient.post<NotificationInboxItemResponse>(
      orgPath(organizationId, `/notifications/inbox/${itemId}/read`),
    ),
  markAllRead: (organizationId: string) =>
    apiClient.post<{ updated: number }>(orgPath(organizationId, '/notifications/inbox/read-all')),
  listPreferences: (organizationId: string) =>
    apiClient.get<NotificationPreferenceListResponse>(orgPath(organizationId, '/notification-preferences')),
  upsertPreferences: (organizationId: string, body: UpsertNotificationPreferencesRequest) =>
    apiClient.put<NotificationPreferenceListResponse>(orgPath(organizationId, '/notification-preferences'), body),
  listTemplates: (organizationId: string) =>
    apiClient.get<NotificationTemplateListResponse>(orgPath(organizationId, '/notification-templates')),
  send: (organizationId: string, body: unknown) =>
    apiClient.post<SendNotificationResponse>(orgPath(organizationId, '/notifications'), body),
};
