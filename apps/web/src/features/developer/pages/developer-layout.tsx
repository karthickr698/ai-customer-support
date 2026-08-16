import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, FlaskConical, KeyRound, Webhook } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { developerPath } from '../routes';

export function DeveloperLayout() {
  return (
    <RequireWorkspacePermission
      description="You need integration.manage to open the developer portal."
      permission="integration.manage"
      title="Developer portal is unavailable"
    >
      <DeveloperShell />
    </RequireWorkspacePermission>
  );
}

function DeveloperShell() {
  const { organizationId } = useWorkspace();
  const items = [
    { to: developerPath(organizationId), label: 'Documentation', icon: BookOpen, end: true },
    { to: developerPath(organizationId, 'keys'), label: 'API keys', icon: KeyRound, end: true },
    { to: developerPath(organizationId, 'webhooks'), label: 'Webhooks', icon: Webhook, end: false },
    { to: developerPath(organizationId, 'sandbox'), label: 'Sandbox', icon: FlaskConical, end: true },
  ];

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Versioned public API docs, keys, webhook delivery logs, request examples, and signature sandbox testing."
        title="Developer portal"
      />
      <nav aria-label="Developer sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
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
