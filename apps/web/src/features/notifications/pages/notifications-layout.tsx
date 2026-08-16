import { NavLink, Outlet } from 'react-router-dom';
import { Bell, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { notificationsPath } from '../labels';

export function NotificationsLayout() {
  return (
    <RequireWorkspacePermission
      description="You need notification.read to open the notification center."
      permission="notification.read"
      title="Notifications are unavailable"
    >
      <NotificationsShell />
    </RequireWorkspacePermission>
  );
}

function NotificationsShell() {
  const { organizationId } = useWorkspace();
  const items = [
    { to: notificationsPath(organizationId), label: 'Inbox', icon: Bell, end: true },
    { to: notificationsPath(organizationId, 'preferences'), label: 'Preferences', icon: SlidersHorizontal, end: true },
  ];

  return (
    <WorkspacePage wide>
      <PageHeader
        description="In-app inbox with unread state, filters, and deep links into tickets or conversations. Preferences control which events reach each channel."
        title="Notifications"
      />
      <nav aria-label="Notification sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
                  'hover:text-foreground',
                  isActive && 'bg-background text-foreground shadow-sm',
                )
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </WorkspacePage>
  );
}
