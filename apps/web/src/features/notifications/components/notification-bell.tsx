import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NotificationInboxListResponse } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { apiClient } from '@/services/api-client';
import { queryKeys } from '@/services/query-keys';
import { notificationsPath } from '../labels';

export function NotificationBell() {
  const { organizationId, permissions } = useWorkspace();
  const canRead = hasPermission(permissions, 'notification.read');
  const inbox = useQuery({
    queryKey: queryKeys.notifications.inbox(organizationId, { unreadOnly: true, pageSize: 1 }),
    queryFn: () =>
      apiClient.get<NotificationInboxListResponse>(
        `/api/organizations/${organizationId}/notifications/inbox`,
        { params: { unreadOnly: 'true', page: 1, pageSize: 1 } },
      ),
    enabled: canRead,
    refetchInterval: 30_000,
  });

  if (!canRead) {
    return null;
  }

  const unread = inbox.data?.unreadCount ?? 0;

  return (
    <Button asChild className="relative" size="icon" variant="ghost">
      <Link aria-label={unread > 0 ? `${String(unread)} unread notifications` : 'Notifications'} to={notificationsPath(organizationId)}>
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unread > 9 ? '9+' : String(unread)}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
